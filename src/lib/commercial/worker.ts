import "server-only";
import { eq, and, asc, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, commercialReminders, infraAuditLog } from "@/lib/db/schema";
import { requireCommercialAccess } from "./access";
import { commercialInboundOwner, ingestCommercialInbound } from "./inbound";
import { synchronizeCommercialWhatsApp } from "./inbox";
import { sendDueCommercialReminder } from "./reminders";
import { reconcileCommercialEmailReceipts } from "./email-receipts";

/** La tabla leads existente es la cola durable del formulario público. */
export async function synchronizeCommercialForms(ownerId?: string) {
  if (!ownerId) ownerId = (await requireCommercialAccess()).userId;
  if (ownerId !== (await commercialInboundOwner())) return { imported: 0 };
  const rows = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.source, "contact_form"),
        sql`not exists (select 1 from commercial_webhook_events e where e.id = 'form:' || ${ownerId} || ':' || ${leads.id}::text)`,
      ),
    )
    .orderBy(asc(leads.createdAt))
    .limit(100);
  let imported = 0;
  for (const lead of rows) {
    const result = await ingestCommercialInbound(ownerId, {
      channel: "form",
      externalId: lead.email.toLowerCase(),
      address: lead.email,
      name: lead.name || lead.email,
      providerId: lead.id,
      body: lead.message || "Contacto desde el sitio web",
      subject: "Contacto desde el sitio web",
      identifierVerified: false,
      receivedAt: lead.createdAt,
    });
    if (!result.repeated) imported++;
  }
  return { imported };
}
export async function runCommercialWorker() {
  const ownerId = await commercialInboundOwner();
  const emailReceipts = await reconcileCommercialEmailReceipts(ownerId);
  const forms = await synchronizeCommercialForms(ownerId);
  let whatsapp: unknown;
  try {
    whatsapp = await synchronizeCommercialWhatsApp(ownerId);
  } catch {
    whatsapp = { error: "whatsapp_sync_unavailable" };
  }
  const due =
    process.env.COMMERCIAL_REMINDERS_ENABLED === "true"
      ? await db
          .select()
          .from(commercialReminders)
          .where(
            and(
              eq(commercialReminders.ownerId, ownerId),
              eq(commercialReminders.status, "scheduled"),
              lte(commercialReminders.scheduledAt, new Date()),
            ),
          )
          .limit(100)
      : [];
  const reminders = [];
  for (const reminder of due)
    reminders.push(await sendDueCommercialReminder(reminder.id, ownerId));
  await db
    .insert(infraAuditLog)
    .values({
      type: "commercial_worker_completed",
      uid: ownerId,
      route: "/api/cron/commercial",
    });
  return {
    forms,
    whatsapp,
    reminders,
    emailReceipts,
    remindersEnabled: process.env.COMMERCIAL_REMINDERS_ENABLED === "true",
  };
}
