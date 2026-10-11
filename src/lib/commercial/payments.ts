import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  billingItems,
  clients,
  commercialCommands,
  paymentRecords,
  clientActivity,
  sales,
} from "@/lib/db/schema";
import { getSaleForQuoteAction } from "@/lib/sales/actions";
import { recordPayment } from "@/lib/documents/billing";
import { requireCommercialAccess, CommercialError } from "./access";
import { day, uuid } from "./schemas";

const paymentInput = createInsertSchema(paymentRecords, {
  billingItemId: uuid,
  amount: z
    .string()
    .regex(/^\d{1,9}(\.\d{1,2})?$/)
    .refine((v) => Number(v) > 0, "Escribe un importe positivo."),
  paidAt: day,
  reference: z.string().trim().max(200),
  note: z.string().trim().max(1500),
})
  .pick({
    billingItemId: true,
    amount: true,
    method: true,
    paidAt: true,
    reference: true,
    note: true,
  })
  .extend({ idempotencyKey: uuid, expectedPeriodDue: day })
  .strict();

async function reconcileProject(billingId: string, ownerId: string) {
  const [row] = await db
    .select({ quoteId: sales.quotationId })
    .from(billingItems)
    .innerJoin(sales, eq(sales.id, billingItems.saleId))
    .where(
      and(eq(billingItems.id, billingId), eq(billingItems.ownerId, ownerId)),
    );
  if (!row?.quoteId) return;
  // La acción canónica calcula el anticipo y aprovisiona una sola vez.
  try {
    const result = await getSaleForQuoteAction(row.quoteId);
    return result.ok
      ? undefined
      : "El pago quedó registrado. Revisa la activación del proyecto desde la venta.";
  } catch {
    return "El pago quedó registrado. Revisa la activación del proyecto desde la venta.";
  }
}

export async function recordCommercialPayment(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const data = paymentInput.parse(raw);
  const [bill] = await db
    .select({ clientId: billingItems.clientId })
    .from(billingItems)
    .innerJoin(clients, eq(clients.id, billingItems.clientId))
    .where(
      and(
        eq(billingItems.id, data.billingItemId),
        eq(billingItems.ownerId, session.userId),
        eq(clients.ownerId, session.userId),
      ),
    );
  if (!bill) throw new CommercialError("El cobro no está disponible.", 404);
  const hash = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const [command] = await db
    .insert(commercialCommands)
    .values({
      id: data.idempotencyKey,
      ownerId: session.userId,
      resourceId: data.billingItemId,
      action: "record_payment",
      payloadHash: hash,
      status: "processing",
    })
    .onConflictDoNothing()
    .returning();
  const marker = "[commercial:" + data.idempotencyKey + "]";
  if (!command) {
    const [existing] = await db
      .select()
      .from(commercialCommands)
      .where(
        and(
          eq(commercialCommands.id, data.idempotencyKey),
          eq(commercialCommands.ownerId, session.userId),
        ),
      );
    if (!existing || existing.payloadHash !== hash)
      throw new CommercialError(
        "La clave del pago ya corresponde a otra operación.",
        409,
      );
    if (existing.status === "done")
      return {
        repeated: true,
        result: existing.result,
        warning: await reconcileProject(data.billingItemId, session.userId),
      };
    // Recuperación después de commit financiero y antes del recibo del comando.
    // Nunca se vuelve a ejecutar recordPayment para un resultado incierto.
    const all = await db
      .select({ id: paymentRecords.id, note: paymentRecords.note })
      .from(paymentRecords)
      .where(
        and(
          eq(paymentRecords.billingItemId, data.billingItemId),
          eq(paymentRecords.createdBy, session.userId),
        ),
      );
    const recovered = all.filter((p) => p.note?.endsWith(marker));
    if (recovered.length === 1) {
      const result = { paymentRecordId: recovered[0].id, recovered: true };
      await db
        .update(commercialCommands)
        .set({ status: "done", result, updatedAt: new Date() })
        .where(eq(commercialCommands.id, data.idempotencyKey));
      return {
        repeated: true,
        result,
        warning: await reconcileProject(data.billingItemId, session.userId),
      };
    }
    throw new CommercialError(
      "Este pago está en proceso o necesita conciliación. Revisa el historial antes de registrar otro.",
      409,
    );
  }
  try {
    const result = await recordPayment(data.billingItemId, {
      amount: Number(data.amount),
      method: data.method,
      paidAt: data.paidAt,
      expectedPeriodDue: data.expectedPeriodDue,
      reference: data.reference || undefined,
      note: (data.note ? data.note + "\n" : "") + marker,
    });
    await db.transaction(async (tx) => {
      await tx
        .update(commercialCommands)
        .set({ status: "done", result, updatedAt: new Date() })
        .where(eq(commercialCommands.id, data.idempotencyKey));
      await tx.insert(clientActivity).values({
        ownerId: session.userId,
        clientId: bill.clientId,
        type: "pago_registrado",
        message: "Pago registrado en el sistema de cobros",
        actorName: session.email,
        metadata: {
          billingItemId: data.billingItemId,
          commandId: data.idempotencyKey,
        },
      });
    });
    return {
      repeated: false,
      result,
      warning: await reconcileProject(data.billingItemId, session.userId),
    };
  } catch {
    await db
      .update(commercialCommands)
      .set({ status: "unknown", updatedAt: new Date() })
      .where(eq(commercialCommands.id, data.idempotencyKey));
    throw new CommercialError(
      "No se pudo confirmar el resultado. Revisa el historial del cobro antes de registrar otro pago.",
      409,
    );
  }
}
