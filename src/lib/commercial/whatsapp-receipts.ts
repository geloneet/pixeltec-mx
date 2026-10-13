import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  commercialConversations as conversations,
  commercialOutbox as outbox,
  commercialWebhookEvents as events,
  clientActivity,
} from "@/lib/db/schema";
import { CommercialError } from "./access";

export const nativeWhatsAppId = z.string().startsWith("wamid.").min(7).max(255);
const receiptInput = createSelectSchema(outbox)
  .pick({ ownerId: true, conversationId: true, body: true, actorId: true })
  .extend({
    clientMessageId: createSelectSchema(outbox).shape.id,
    providerMessageId: nativeWhatsAppId,
    delivery: z.enum(["sent", "delivered", "read", "failed"]),
    address: createSelectSchema(conversations).shape.address,
  })
  .strict();

/** Authenticated PixelBot history is authoritative; only a matching owned
 * intention can advance. The history itself stays in PixelBot. */
export async function reconcileCommercialWhatsAppReceipt(raw: unknown) {
  const data = receiptInput.parse(raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(outbox)
      .where(
        and(
          eq(outbox.id, data.clientMessageId),
          eq(outbox.ownerId, data.ownerId),
          eq(outbox.conversationId, data.conversationId),
        ),
      )
      .for("update");
    if (!row || row.body !== data.body || row.actorId !== data.actorId)
      return false;
    const [c] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, row.conversationId),
          eq(conversations.ownerId, data.ownerId),
          eq(conversations.channel, "whatsapp"),
          eq(conversations.address, data.address),
        ),
      );
    if (!c) return false;
    if (row.providerId && row.providerId !== data.providerMessageId)
      throw new CommercialError("whatsapp_receipt_conflict", 409);
    const status = data.delivery === "read" ? "delivered" : data.delivery;
    const changed =
      row.providerId !== data.providerMessageId ||
      (!["delivered", "failed"].includes(row.status) && row.status !== status);
    const eventId =
      "pixelbot:" +
      createHash("sha256")
        .update(
          JSON.stringify([
            data.ownerId,
            row.id,
            data.providerMessageId,
            data.delivery,
          ]),
        )
        .digest("hex");
    await tx
      .insert(events)
      .values({
        id: eventId,
        provider: "pixelbot_verified_receipt",
        payloadHash: createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex"),
        providerMessageId: data.providerMessageId,
        delivery: status,
        status: "done",
        processedAt: new Date(),
      })
      .onConflictDoNothing();
    if (!changed) return false;
    const terminal = ["delivered", "failed"].includes(row.status);
    await tx
      .update(outbox)
      .set({
        providerId: data.providerMessageId,
        status: terminal ? row.status : status,
        errorCode: terminal
          ? row.errorCode
          : status === "failed"
            ? "whatsapp_delivery_failed"
            : null,
        updatedAt: new Date(),
      })
      .where(eq(outbox.id, row.id));
    if (c.clientId)
      await tx.insert(clientActivity).values({
        ownerId: c.ownerId,
        clientId: c.clientId,
        type: "commercial_delivery",
        actorName: "PixelBot",
        message: "Recibo de WhatsApp: " + data.delivery,
        metadata: {
          outboxId: row.id,
          conversationId: c.id,
          delivery: data.delivery,
        },
      });
    return true;
  });
}
