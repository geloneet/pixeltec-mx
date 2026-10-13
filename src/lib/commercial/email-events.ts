import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  commercialConversations,
  commercialMessages,
  commercialWebhookEvents,
  infraAuditLog,
} from "@/lib/db/schema";
import {
  getCommercialReceivedEmail,
  listCommercialReceivedEmails,
} from "@/lib/email";
import { commercialInboundOwner, ingestCommercialInbound } from "./inbound";
import { CommercialError, requireCommercialAccess } from "./access";
import { contactInput, emailSyncInput } from "./schemas";
import { runApprovedCommercialReply } from "./inbox";
import { reconcileCommercialEmailReceipts } from "./email-receipts";

const eventInput = createSelectSchema(commercialMessages)
  .pick({ providerId: true })
  .partial()
  .extend({
    type: z.string().max(100),
    created_at: z.coerce.date(),
    data: z.object({ email_id: z.string().uuid() }).passthrough(),
  })
  .passthrough();
const messageFields = createSelectSchema(commercialMessages, {
  providerId: z.string().uuid(),
  body: z.string().max(1000000),
  createdAt: z.coerce.date(),
}).shape;
const conversationFields = createSelectSchema(commercialConversations, {
  address: z.string().max(500),
  subject: z.string().max(200),
}).shape;
const receivedSummaryInput = z
  .object({
    id: messageFields.providerId,
    from: conversationFields.address,
    to: z.array(conversationFields.address).max(100),
    subject: conversationFields.subject,
    created_at: messageFields.createdAt,
  })
  .passthrough();
const receivedInput = receivedSummaryInput.extend({
  text: messageFields.body.nullable(),
  html: messageFields.body.nullable(),
});
function mailbox(value: string) {
  return (
    value
      .match(/<([^<>]+)>/)?.[1]
      ?.trim()
      .toLowerCase() || value.trim().toLowerCase()
  );
}
function configuredReceivers() {
  if (process.env.COMMERCIAL_EMAIL_RECEIVING_ENABLED !== "true")
    throw new CommercialError("email_receiving_disabled", 503);
  const receivers = (process.env.COMMERCIAL_INBOUND_ADDRESSES || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (
    !receivers.length ||
    !receivers.every((v) => contactInput.shape.email.safeParse(v).success)
  )
    throw new CommercialError("email_receiving_addresses_not_configured", 503);
  return receivers;
}
/** Internal provider adapter. The caller establishes signature or admin/owner access. */
async function ingestReceivedEmail(
  ownerId: string,
  raw: unknown,
  receivers: string[],
) {
  const email = receivedInput.parse(raw);
  if (!email.to.some((v) => receivers.includes(mailbox(v)))) return null;
  const address = mailbox(email.from);
  const body =
    (
      email.text ||
      email.html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") ||
      ""
    )
      .trim()
      .slice(0, 12000) || "[Correo sin texto]";
  const result = await ingestCommercialInbound(ownerId, {
    channel: "email",
    externalId: address,
    address,
    name:
      email.from
        .replace(/<[^>]*>/g, "")
        .trim()
        .slice(0, 200) || address,
    providerId: email.id,
    body,
    subject: email.subject,
    identifierVerified: false,
    receivedAt: email.created_at,
  });
  return { ...result, email, body };
}
/** Recover one bounded page without sending replies or representing an API read as Svix. */
export async function synchronizeCommercialEmail(raw: unknown = {}) {
  const session = await requireCommercialAccess(true);
  const filter = emailSyncInput.parse(raw);
  if (session.userId !== (await commercialInboundOwner()))
    throw new CommercialError("Tenant no asignado a esta cartera.", 403);
  const receivers = configuredReceivers();
  const pageInput = z.object({
    data: z.array(receivedSummaryInput).max(100),
    has_more: z.boolean(),
  });
  let page: z.infer<typeof pageInput>;
  try {
    page = pageInput.parse(await listCommercialReceivedEmails(filter.after));
  } catch {
    throw new CommercialError("email_receiving_provider_failed", 503);
  }
  if (page.has_more && !page.data.length)
    throw new CommercialError("email_receiving_provider_failed", 503);
  let imported = 0;
  for (const item of page.data) {
    // Do not fetch bodies for other mailboxes sharing the Resend account.
    if (!item.to.some((v) => receivers.includes(mailbox(v)))) continue;
    let email: z.infer<typeof receivedInput>;
    try {
      email = receivedInput.parse(await getCommercialReceivedEmail(item.id));
    } catch {
      throw new CommercialError("email_receiving_provider_failed", 503);
    }
    if (email.id !== item.id)
      throw new CommercialError("email_receiving_provider_failed", 503);
    const result = await ingestReceivedEmail(session.userId, email, receivers);
    if (result && !result.repeated) imported++;
  }
  await db.insert(infraAuditLog).values({
    uid: session.userId,
    type: "commercial_email_recovery_completed",
    route: "/api/commercial",
  });
  return {
    ok: true,
    imported,
    nextCursor: page.has_more ? page.data.at(-1)!.id : null,
  };
}
/** Caller verifies raw Svix signature before passing this event. */
export async function processCommercialEmailEvent(
  raw: unknown,
  eventId: string,
) {
  const event = eventInput.parse(raw);
  if (event.type === "email.received") {
    const receivers = configuredReceivers();
    const metadata = receivedSummaryInput.pick({ to: true }).parse(event.data);
    if (!metadata.to.some((v) => receivers.includes(mailbox(v))))
      return { ignored: true };
    const hash = createHash("sha256")
      .update(JSON.stringify(event))
      .digest("hex");
    const receiptId = "resend-inbound:" + eventId;
    await db
      .insert(commercialWebhookEvents)
      .values({
        id: receiptId,
        provider: "resend_verified_inbound",
        providerMessageId: event.data.email_id,
        payloadHash: hash,
        status: "processing",
      })
      .onConflictDoNothing();
    const [prior] = await db
      .select()
      .from(commercialWebhookEvents)
      .where(eq(commercialWebhookEvents.id, receiptId));
    if (!prior || prior.payloadHash !== hash)
      throw new CommercialError("event_payload_conflict", 409);
    const rawEmail = await getCommercialReceivedEmail(event.data.email_id);
    const email = receivedInput.parse(rawEmail);
    if (email.id !== event.data.email_id)
      throw new CommercialError("email_receiving_provider_failed", 503);
    const result = await ingestReceivedEmail(
      await commercialInboundOwner(),
      email,
      receivers,
    );
    if (!result) return { ignored: true };
    await db
      .update(commercialWebhookEvents)
      .set({ status: "done", processedAt: new Date() })
      .where(eq(commercialWebhookEvents.id, receiptId));
    if (result.conversation)
      await runApprovedCommercialReply(
        result.conversation,
        result.body,
        email.id,
      );
    return { ok: true, repeated: result.repeated };
  }
  const delivery =
    event.type === "email.delivered"
      ? "delivered"
      : event.type === "email.bounced" || event.type === "email.failed"
        ? "failed"
        : event.type === "email.sent"
          ? "sent"
          : null;
  if (!delivery) return { ignored: true };
  const hash = createHash("sha256").update(JSON.stringify(event)).digest("hex");
  const result = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${eventId},0))`,
    );
    const [prior] = await tx
      .select()
      .from(commercialWebhookEvents)
      .where(eq(commercialWebhookEvents.id, "resend:" + eventId));
    if (prior) {
      if (prior.payloadHash !== hash)
        throw new CommercialError("event_payload_conflict", 409);
      return { ok: true, repeated: true };
    }
    await tx.insert(commercialWebhookEvents).values({
      id: "resend:" + eventId,
      provider: "resend",
      payloadHash: hash,
      status: "processing",
      providerMessageId: event.data.email_id,
      delivery,
      occurredAt: event.created_at,
    });
    return { ok: true, repeated: false };
  });
  await reconcileCommercialEmailReceipts(undefined, event.data.email_id);
  return result;
}
