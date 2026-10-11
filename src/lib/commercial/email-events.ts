import "server-only";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import { commercialMessages, commercialWebhookEvents } from "@/lib/db/schema";
import { getCommercialReceivedEmail } from "@/lib/email";
import { commercialInboundOwner, ingestCommercialInbound } from "./inbound";
import { CommercialError } from "./access";
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
const receivedInput = z
  .object({
    id: z.string().uuid(),
    from: z.string().max(500),
    to: z.array(z.string().max(500)),
    subject: z.string().max(200),
    text: z.string().nullable(),
    html: z.string().nullable(),
    created_at: z.coerce.date(),
  })
  .passthrough();
function mailbox(value: string) {
  return (
    value
      .match(/<([^<>]+)>/)?.[1]
      ?.trim()
      .toLowerCase() || value.trim().toLowerCase()
  );
}
/** Caller verifies raw Svix signature before passing this event. */
export async function processCommercialEmailEvent(
  raw: unknown,
  eventId: string,
) {
  const event = eventInput.parse(raw);
  if (event.type === "email.received") {
    if (process.env.COMMERCIAL_EMAIL_RECEIVING_ENABLED !== "true")
      throw new CommercialError("email_receiving_disabled", 503);
    const email = receivedInput.parse(
      await getCommercialReceivedEmail(event.data.email_id),
    );
    const receivers = (process.env.COMMERCIAL_INBOUND_ADDRESSES || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean);
    if (!receivers.length)
      throw new CommercialError(
        "email_receiving_addresses_not_configured",
        503,
      );
    if (!email.to.some((v) => receivers.includes(mailbox(v))))
      return { ignored: true };
    const address = mailbox(email.from);
    const body = (
      email.text ||
      email.html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ") ||
      "[Correo sin texto]"
    ).slice(0, 12000);
    const result = await ingestCommercialInbound(
      await commercialInboundOwner(),
      {
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
      },
    );
    await db
      .insert(commercialWebhookEvents)
      .values({
        id: "resend-inbound:" + eventId,
        provider: "resend_verified_inbound",
        payloadHash: createHash("sha256")
          .update(JSON.stringify(event))
          .digest("hex"),
        status: "done",
        processedAt: new Date(),
      })
      .onConflictDoNothing();
    if (result.conversation)
      await runApprovedCommercialReply(result.conversation, body, email.id);
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
