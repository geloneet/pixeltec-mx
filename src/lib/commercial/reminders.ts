import "server-only";
import { and, eq, lte, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  billingItems,
  paymentRecords,
  commercialConversations,
  commercialReminders,
  commercialOutbox,
  clientActivity,
} from "@/lib/db/schema";
import { requireCommercialAccess, CommercialError } from "./access";
import { reminderInput, uuid } from "./schemas";
import { dispatchCommercialOutbox, eventKey } from "./inbox";
import { reminderBody } from "./message-content";
import { createHash } from "node:crypto";

export async function scheduleCommercialReminder(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const data = reminderInput.required().parse(raw);
  if (
    data.scheduledAt.getTime() < Date.now() - 60000 ||
    data.scheduledAt.getTime() > Date.now() + 366 * 86400000
  )
    throw new CommercialError("Elige una fecha entre ahora y un año.");
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(commercialConversations)
      .where(
        and(
          eq(commercialConversations.id, data.conversationId),
          eq(commercialConversations.ownerId, session.userId),
        ),
      )
      .for("update");
    const [bill] = await tx
      .select()
      .from(billingItems)
      .where(
        and(
          eq(billingItems.id, data.billingItemId),
          eq(billingItems.ownerId, session.userId),
        ),
      )
      .for("update");
    if (!c || !bill || c.clientId !== bill.clientId || c.matchReview)
      throw new CommercialError(
        "Elige una conversación vinculada a este cliente.",
      );
    if (c.mode !== "HUMAN")
      throw new CommercialError(
        "Activa atención humana en esta conversación antes de programar.",
      );
    if (
      bill.dueDate !== data.duePeriod ||
      ["pagado", "cancelado"].includes(bill.status) ||
      bill.remindedForDueDate === bill.dueDate
    )
      throw new CommercialError(
        "Este período ya se liquidó o recibió su recordatorio.",
        409,
      );
    const paid = await tx
      .select()
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.billingItemId, bill.id),
          eq(paymentRecords.periodKey, bill.dueDate),
        ),
      );
    if (
      paid.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0) >=
      Math.round(Number(bill.amount) * 100)
    )
      throw new CommercialError("Este saldo ya está liquidado.", 409);
    const [existing] = await tx
      .select()
      .from(commercialReminders)
      .where(
        and(
          eq(commercialReminders.billingItemId, bill.id),
          eq(commercialReminders.duePeriod, bill.dueDate),
        ),
      )
      .for("update");
    if (existing && !["paused", "cancelled"].includes(existing.status))
      throw new CommercialError(
        "Ya hay un recordatorio para este período. Pausa el actual antes de cambiarlo.",
        409,
      );
    const [row] = await tx
      .insert(commercialReminders)
      .values({ ...data, ownerId: session.userId, createdBy: session.userId })
      .onConflictDoUpdate({
        target: [
          commercialReminders.billingItemId,
          commercialReminders.duePeriod,
        ],
        set: {
          ...data,
          status: "scheduled",
          revision: (existing?.revision || 0) + 1,
          updatedAt: new Date(),
        },
      })
      .returning();
    await tx.insert(clientActivity).values({
      ownerId: session.userId,
      clientId: bill.clientId,
      type: "commercial_reminder",
      actorName: session.email,
      message: "Recordatorio programado",
      metadata: {
        id: row.id,
        period: bill.dueDate,
        scheduledAt: data.scheduledAt.toISOString(),
      },
    });
    return { ok: true, id: row.id };
  });
}
export async function pauseCommercialReminder(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const data = createSelectSchema(commercialReminders)
    .pick({ id: true, revision: true })
    .strict()
    .parse(raw);
  const [r] = await db
    .update(commercialReminders)
    .set({
      status: "paused",
      revision: sql`${commercialReminders.revision}+1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(commercialReminders.id, data.id),
        eq(commercialReminders.ownerId, session.userId),
        eq(commercialReminders.revision, data.revision),
        sql`${commercialReminders.status} in ('scheduled','failed')`,
        sql`not exists (select 1 from commercial_outbox o where o.id=${commercialReminders.outboxId} and o.status in ('sending','unknown','sent','delivered'))`,
      ),
    )
    .returning();
  if (!r)
    throw new CommercialError(
      "El recordatorio cambió o ya fue enviado. Recarga.",
      409,
    );
  const [bill] = await db
    .select()
    .from(billingItems)
    .where(eq(billingItems.id, r.billingItemId));
  await db.insert(clientActivity).values({
    ownerId: session.userId,
    clientId: bill.clientId,
    type: "commercial_reminder",
    actorName: session.email,
    message: "Recordatorio pausado",
    metadata: { id: r.id },
  });
  return { ok: true };
}
export async function sendDueCommercialReminder(id: string, ownerId: string) {
  uuid.parse(id);
  uuid.parse(ownerId);
  const [r] = await db
    .select()
    .from(commercialReminders)
    .where(
      and(
        eq(commercialReminders.id, id),
        eq(commercialReminders.ownerId, ownerId),
        eq(commercialReminders.status, "scheduled"),
        lte(commercialReminders.scheduledAt, new Date()),
      ),
    );
  if (!r) return { status: "not_due" };
  const [bill] = await db
    .select()
    .from(billingItems)
    .where(
      and(
        eq(billingItems.id, r.billingItemId),
        eq(billingItems.ownerId, ownerId),
      ),
    );
  if (!bill) throw new CommercialError("Cobro no disponible.", 404);
  const payments = await db
    .select()
    .from(paymentRecords)
    .where(
      and(
        eq(paymentRecords.billingItemId, bill.id),
        eq(paymentRecords.periodKey, r.duePeriod),
      ),
    );
  const remaining =
    Math.round(Number(bill.amount) * 100) -
    payments.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
  const body = reminderBody(r.body, remaining, bill.currency, r.duePeriod);
  const payload = {
    conversationId: r.conversationId,
    idempotencyKey: eventKey("reminder:" + r.id + ":" + r.revision),
    body,
    subject: "Recordatorio de saldo · PixelTEC",
  };
  const hash = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
  const [newOutbox] = await db
    .insert(commercialOutbox)
    .values({ ...payload, payloadHash: hash, ownerId, actorId: r.createdBy })
    .onConflictDoNothing()
    .returning();
  const [existing] = newOutbox
    ? []
    : await db
        .select()
        .from(commercialOutbox)
        .where(
          and(
            eq(commercialOutbox.ownerId, ownerId),
            eq(commercialOutbox.idempotencyKey, payload.idempotencyKey),
          ),
        );
  const outgoing = newOutbox || existing;
  const [bound] = await db
    .update(commercialReminders)
    .set({ outboxId: outgoing.id, updatedAt: new Date() })
    .where(
      and(
        eq(commercialReminders.id, r.id),
        eq(commercialReminders.revision, r.revision),
        eq(commercialReminders.status, "scheduled"),
      ),
    )
    .returning();
  if (!bound) return { status: "not_due" };
  const result = await dispatchCommercialOutbox(outgoing.id, ownerId, {
    reminderId: r.id,
  });
  await db
    .update(commercialReminders)
    .set({
      status: ["sent", "delivered"].includes(result.status)
        ? "sent"
        : result.status === "failed"
          ? "failed"
          : "scheduled",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(commercialReminders.id, r.id),
        eq(commercialReminders.status, "scheduled"),
      ),
    );
  return result;
}
export async function sendCommercialReminderNow(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const { id } = z.object({ id: uuid }).strict().parse(raw);
  return sendDueCommercialReminder(id, session.userId);
}
