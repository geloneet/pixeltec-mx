import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  commercialWebhookEvents as events,
  commercialOutbox as outbox,
  commercialMessages as messages,
} from "@/lib/db/schema";

/** Signed receipts survive the race with send commit. Unrelated provider mail
 * stays pending without causing webhook retries or claiming commercial delivery. */
export async function reconcileCommercialEmailReceipts(
  ownerId?: string,
  providerId?: string,
) {
  const pending = await db
    .select()
    .from(events)
    .where(
      and(
        eq(events.provider, "resend"),
        eq(events.status, "processing"),
        sql`${events.providerMessageId} is not null`,
        providerId ? eq(events.providerMessageId, providerId) : undefined,
        sql`exists (select 1 from commercial_outbox o where o.provider_id=${events.providerMessageId}${ownerId ? sql` and o.owner_id=${ownerId}` : sql``})`,
      ),
    )
    .orderBy(asc(events.occurredAt), asc(events.receivedAt))
    .limit(100);
  for (const event of pending)
    await db.transaction(async (tx) => {
      const [receipt] = await tx
        .select()
        .from(events)
        .where(and(eq(events.id, event.id), eq(events.status, "processing")))
        .for("update");
      if (!receipt?.providerMessageId || !receipt.delivery) return;
      const [row] = await tx
        .select()
        .from(outbox)
        .where(
          and(
            eq(outbox.providerId, receipt.providerMessageId),
            ownerId ? eq(outbox.ownerId, ownerId) : undefined,
          ),
        )
        .for("update");
      if (!row) return;
      if (
        row.status !== "delivered" &&
        !(row.status === "failed" && receipt.delivery === "sent")
      ) {
        await tx
          .update(outbox)
          .set({
            status: receipt.delivery,
            errorCode:
              receipt.delivery === "failed" ? "email_delivery_failed" : null,
            updatedAt: new Date(),
          })
          .where(eq(outbox.id, row.id));
        await tx
          .update(messages)
          .set({ delivery: receipt.delivery })
          .where(
            and(
              eq(messages.conversationId, row.conversationId),
              eq(messages.providerId, receipt.providerMessageId),
            ),
          );
      }
      await tx
        .update(events)
        .set({ status: "done", processedAt: new Date() })
        .where(eq(events.id, receipt.id));
    });
  return { reconciled: pending.length };
}
