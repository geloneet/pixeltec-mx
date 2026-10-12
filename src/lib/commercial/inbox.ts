import "server-only";
import { createHash } from "node:crypto";
import { and, eq, asc, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  clients,
  commercialConversations as conversations,
  commercialMessages as messages,
  commercialOutbox as outbox,
  commercialPolicies as policies,
  commercialIdentifiers,
  commercialOpportunities,
  clientActivity,
  billingItems,
  paymentRecords,
  commercialReminders,
  commercialWebhookEvents,
  infraAuditLog,
  commercialPolicyVersions,
} from "@/lib/db/schema";
import { getPhoneNumberInfo } from "@/lib/whatsapp/management";
import { sendEmail, verifyCommercialEmailDomain } from "@/lib/email";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";
import {
  assertEmailEgressAllowed,
  assertWhatsAppEgressAllowed,
  EgressBlockedError,
} from "@/lib/egress-guard";
import { messageInput, modeInput, policyInput, uuid, whatsappSyncInput } from "./schemas";
import { requireCommercialAccess, CommercialError } from "./access";
import { commercialInboundOwner, ingestCommercialInbound } from "./inbound";
import { approvedReply } from "./policy";
import { reminderBody } from "./message-content";
import { reconcileCommercialEmailReceipts } from "./email-receipts";

type Conversation = typeof conversations.$inferSelect;
type Outbox = typeof outbox.$inferSelect;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function eventKey(value: string) {
  const h = digest(value);
  return (
    h.slice(0, 8) +
    "-" +
    h.slice(8, 12) +
    "-4" +
    h.slice(13, 16) +
    "-8" +
    h.slice(17, 20) +
    "-" +
    h.slice(20, 32)
  );
}
const providerDate = z
  .string()
  .transform((v) => new Date(v.includes("T") ? v : v.replace(" ", "T") + "Z"))
  .refine((v) => !Number.isNaN(v.getTime()), "Fecha inválida del proveedor");
const remoteMessage = createSelectSchema(messages)
  .pick({ body: true })
  .partial()
  .extend({
    id: z.union([z.string(), z.number()]).transform(String),
    direction: z.enum(["inbound", "outbound"]),
    text: z.string().nullable().optional(),
    caption: z.string().nullable().optional(),
    createdAt: providerDate,
    deliveryStatus: z.string().nullable().optional(),
  })
  .passthrough();
const remoteMessages = z.object({ messages: z.array(remoteMessage).max(1000) });
function tenant() {
  const id = process.env.PIXELBOT_TENANT_ID;
  if (!id)
    throw new CommercialError(
      "Configura PIXELBOT_TENANT_ID en el gestor de secretos.",
      503,
    );
  return id;
}
async function ownedConversation(id: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, uuid.parse(id)),
        eq(conversations.ownerId, ownerId),
      ),
    );
  if (!row) throw new CommercialError("Conversación no disponible.", 404);
  return row;
}
async function audit(
  c: Conversation,
  actorId: string,
  message: string,
  metadata: unknown = {},
) {
  if (c.clientId)
    await db.insert(clientActivity).values({
      ownerId: c.ownerId,
      clientId: c.clientId,
      type: "commercial_conversation",
      actorName: actorId,
      message,
      metadata,
    });
}
async function isolatePixelbot(c: Conversation, actorId: string) {
  if (c.channel !== "whatsapp") return;
  if (c.ownerId !== (await commercialInboundOwner()))
    throw new CommercialError(
      "Esta cartera no tiene asignado el tenant WhatsApp.",
      403,
    );
  // PixelBot conserva el historial, pero su agente libre queda pausado.
  // El Centro ejecuta exclusivamente las respuestas aprobadas de su política.
  const { data } = await fetchPixelbot("/internal/conversations/mode", {
    tenant_id: tenant(),
    phone: c.address,
    mode: "PAUSED",
    changed_by_uid: actorId,
  });
  const paused = z.object({ status: z.literal("ok"), mode: z.literal("PAUSED") })
    .passthrough()
    .safeParse(data);
  if (!paused.success)
    throw new CommercialError("whatsapp_pause_not_confirmed", 409);
}
export async function getCommercialThread(id: string) {
  const session = await requireCommercialAccess();
  const c = await ownedConversation(id, session.userId);
  if (c.channel === "whatsapp") {
    if (c.ownerId !== (await commercialInboundOwner()))
      throw new CommercialError("Tenant no asignado a esta cartera.", 403);
    const { data } = await fetchPixelbot(
      "/internal/conversations/" +
        encodeURIComponent(c.address) +
        "/messages?tenant_id=" +
        encodeURIComponent(tenant()) +
        "&limit=200",
      undefined,
      "GET",
    );
    return remoteMessages.parse(data).messages.map((m) => ({
      id: m.id,
      direction: m.direction,
      body:
        m.text || m.caption || "[Contenido multimedia: consultar en WhatsApp]",
      delivery: m.deliveryStatus || "unknown",
      createdAt: m.createdAt.toISOString(),
    }));
  }
  return (
    await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, c.id))
      .orderBy(asc(messages.createdAt))
  ).map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }));
}
export async function setCommercialMode(raw: unknown) {
  const session = await requireCommercialAccess();
  const data = modeInput.parse(raw);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, data.id),
          eq(conversations.ownerId, session.userId),
        ),
      )
      .for("update");
    if (!c) throw new CommercialError("Conversación no disponible.", 404);
    if (c.revision !== data.revision)
      throw new CommercialError(
        "La conversación cambió. Recarga antes de continuar.",
        409,
      );
    if (data.mode === "BOT") {
      if (
        c.channel === "whatsapp" &&
        process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE !== "true"
      )
        throw new CommercialError(
          "La automatización de WhatsApp requiere confirmar que este Centro es el único emisor automático del tenant.",
          409,
        );
      const [policy] = await tx
        .select()
        .from(policies)
        .where(eq(policies.ownerId, session.userId));
      if (!policy?.automaticEnabled || c.matchReview)
        throw new CommercialError(
          "Aprueba la política y resuelve la identidad antes de reactivar el asistente.",
        );
    }
    await isolatePixelbot(c, session.userId);
    await tx
      .update(conversations)
      .set({
        mode: data.mode,
        state: data.mode === "BOT" ? "sin_atender" : "humano",
        revision: c.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, c.id));
    if (c.clientId)
      await tx.insert(clientActivity).values({
        ownerId: c.ownerId,
        clientId: c.clientId,
        type: "commercial_mode",
        actorName: session.email,
        message: "Modo comercial: " + data.mode,
        metadata: { conversationId: c.id, previous: c.mode },
      });
    return { ok: true };
  });
}
/** Claim durable before network; an interrupted send is never blindly replayed. */
async function enqueue(ownerId: string, actorId: string, raw: unknown) {
  const data = messageInput.parse(raw);
  const c = await ownedConversation(data.conversationId, ownerId);
  if (c.matchReview || !c.clientId)
    throw new CommercialError(
      "Vincula y verifica el contacto antes de enviar.",
    );
  const hash = digest(data);
  const [created] = await db
    .insert(outbox)
    .values({ ...data, ownerId, actorId, payloadHash: hash })
    .onConflictDoNothing()
    .returning();
  const [row] = created
    ? [created]
    : await db
        .select()
        .from(outbox)
        .where(
          and(
            eq(outbox.ownerId, ownerId),
            eq(outbox.idempotencyKey, data.idempotencyKey),
          ),
        );
  if (!row || row.payloadHash !== hash)
    throw new CommercialError(
      "La clave de envío ya corresponde a otro mensaje.",
      409,
    );
  return row;
}
const escape = (v: string) =>
  v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
export async function dispatchCommercialOutbox(
  id: string,
  ownerId: string,
  options: {
    automatic?: boolean;
    reminderId?: string;
    inboundAt?: Date | null;
    policyRevision?: number;
  } = {},
) {
  const [claim] = await db
    .update(outbox)
    .set({
      status: "sending",
      attempts: sql`${outbox.attempts}+1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(outbox.id, id),
        eq(outbox.ownerId, ownerId),
        eq(outbox.status, "queued"),
      ),
    )
    .returning();
  if (!claim) {
    const [existing] = await db
      .select()
      .from(outbox)
      .where(and(eq(outbox.id, id), eq(outbox.ownerId, ownerId)));
    if (!existing) throw new CommercialError("Envío no disponible.", 404);
    return {
      id: existing.id,
      status: existing.status,
      error: existing.errorCode,
    };
  }
  let result: {
    status: Outbox["status"];
    providerId?: string;
    error?: string;
  } = { status: "unknown", error: "delivery_unconfirmed" };
  try {
    result = await db.transaction(async (tx) => {
      const [c] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, claim.conversationId),
            eq(conversations.ownerId, ownerId),
          ),
        )
        .for("update");
      if (!c || c.matchReview || !c.clientId)
        throw new CommercialError("contact_review_required");
      if (options.automatic) {
        const [policy] = await tx
          .select()
          .from(policies)
          .where(eq(policies.ownerId, ownerId));
        if (c.mode !== "BOT" || !policy?.automaticEnabled)
          throw new CommercialError("automatic_paused");
        if (
          c.lastInboundAt?.getTime() !== options.inboundAt?.getTime() ||
          policy.revision !== options.policyRevision
        )
          throw new CommercialError("automatic_context_changed");
      } else if (c.mode !== "HUMAN")
        throw new CommercialError(
          "Activa atención humana antes de confirmar el envío.",
        );
      if (options.reminderId) {
        const [r] = await tx
          .select()
          .from(commercialReminders)
          .where(
            and(
              eq(commercialReminders.id, options.reminderId),
              eq(commercialReminders.ownerId, ownerId),
            ),
          )
          .for("update");
        if (
          !r ||
          r.status !== "scheduled" ||
          r.scheduledAt > new Date() ||
          r.outboxId !== claim.id ||
          claim.idempotencyKey !==
            eventKey("reminder:" + r.id + ":" + r.revision)
        )
          throw new CommercialError("reminder_paused");
        const [bill] = await tx
          .select()
          .from(billingItems)
          .where(
            and(
              eq(billingItems.id, r.billingItemId),
              eq(billingItems.ownerId, ownerId),
            ),
          )
          .for("update");
        const paid = bill
          ? await tx
              .select()
              .from(paymentRecords)
              .where(
                and(
                  eq(paymentRecords.billingItemId, bill.id),
                  eq(paymentRecords.periodKey, bill.dueDate),
                ),
              )
          : [];
        if (
          !bill ||
          bill.clientId !== c.clientId ||
          bill.dueDate !== r.duePeriod ||
          ["pagado", "cancelado"].includes(bill.status) ||
          paid.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0) >=
            Math.round(Number(bill.amount) * 100) ||
          bill.remindedForDueDate === r.duePeriod
        ) {
          await tx
            .update(commercialReminders)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(commercialReminders.id, r.id));
          return { status: "failed" as const, error: "reminder_no_longer_due" };
        }
        const currentBalance =
          Math.round(Number(bill.amount) * 100) -
          paid.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0);
        if (
          claim.body !==
          reminderBody(r.body, currentBalance, bill.currency, r.duePeriod)
        )
          return {
            status: "failed" as const,
            error: "reminder_balance_changed",
          };
        // Serializa con el pago y el scheduler anterior para este mismo período.
      }
      if (c.channel === "whatsapp") {
        // Automatización exige traspaso del tenant; una respuesta humana
        // confirma PAUSED de su conversación antes de cada envío.
        if (options.automatic && process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE !== "true")
          throw new CommercialError("whatsapp_handoff_pending", 409);
        if (
          !c.lastInboundAt ||
          Date.now() - c.lastInboundAt.getTime() >= 86400000
        )
          throw new CommercialError(
            "Fuera de la ventana de WhatsApp: requiere una plantilla aprobada. Usa correo o espera un mensaje del cliente.",
          );
        assertWhatsAppEgressAllowed(c.address);
        await isolatePixelbot(c, claim.actorId);
        const { data } = await fetchPixelbot("/internal/send", {
          tenant_id: tenant(),
          phone: c.address,
          text: claim.body,
          sent_by_uid: claim.actorId,
          client_message_id: claim.id,
        });
        const response = z
          .object({
            status: z.enum([
              "sent",
              "persisted_but_send_failed",
              "already_persisted",
            ]),
          })
          .passthrough()
          .parse(data);
        if (response.status !== "sent")
          return {
            status: "unknown" as const,
            error: "whatsapp_original_receipt_unconfirmed",
          };
      } else {
        assertEmailEgressAllowed({ to: c.address });
        const sent = await sendEmail(
          c.address,
          claim.subject || "PixelTEC · " + c.subject,
          '<div style="white-space:pre-wrap">' + escape(claim.body) + "</div>",
          undefined,
          {
            idempotencyKey: "commercial/" + claim.id,
            replyTo: process.env.COMMERCIAL_REPLY_TO,
          },
        );
        if (!sent.success)
          return {
            status:
              sent.error === "email_unknown_failure"
                ? ("unknown" as const)
                : ("failed" as const),
            error: sent.error,
          };
        if (!sent.id)
          return { status: "unknown" as const, error: "email_missing_receipt" };
        await tx
          .insert(messages)
          .values({
            conversationId: c.id,
            providerId: sent.id,
            direction: "outbound",
            body: claim.body,
            delivery: "sent",
            actorId: claim.actorId,
          })
          .onConflictDoNothing();
        await tx
          .update(conversations)
          .set({
            state: "esperando",
            updatedAt: new Date(),
            revision: c.revision + 1,
          })
          .where(eq(conversations.id, c.id));
        if (options.reminderId)
          await tx
            .update(billingItems)
            .set({
              remindedForDueDate: sql`${billingItems.dueDate}`,
              updatedAt: new Date(),
            })
            .where(
              eq(
                billingItems.id,
                sql`(select billing_item_id from commercial_reminders where id=${options.reminderId})`,
              ),
            );
        return { status: "sent" as const, providerId: sent.id };
      }
      await tx
        .update(conversations)
        .set({
          state: "esperando",
          updatedAt: new Date(),
          revision: c.revision + 1,
        })
        .where(eq(conversations.id, c.id));
      if (options.reminderId)
        await tx
          .update(billingItems)
          .set({
            remindedForDueDate: sql`${billingItems.dueDate}`,
            updatedAt: new Date(),
          })
          .where(
            eq(
              billingItems.id,
              sql`(select billing_item_id from commercial_reminders where id=${options.reminderId})`,
            ),
          );
      return { status: "sent" as const };
    });
  } catch (error) {
    // Rechazos locales son seguros; timeout/upstream requiere conciliación.
    result = {
      status:
        error instanceof CommercialError ||
        (error instanceof Error && error.name === "EgressBlockedError")
          ? "failed"
          : "unknown",
      error:
        error instanceof CommercialError
          ? error.code
          : error instanceof EgressBlockedError
            ? error.code
            : "delivery_unconfirmed",
    };
  }
  await db
    .update(outbox)
    .set({
      status: result.status,
      providerId: result.providerId || null,
      errorCode: result.error || null,
      updatedAt: new Date(),
    })
    .where(and(eq(outbox.id, claim.id), eq(outbox.status, "sending")));
  const c = await ownedConversation(claim.conversationId, ownerId);
  await audit(c, claim.actorId, "Envío comercial: " + result.status, {
    outboxId: claim.id,
    code: result.error || null,
  });
  if (result.providerId)
    await reconcileCommercialEmailReceipts(ownerId, result.providerId);
  return { id: claim.id, status: result.status, error: result.error };
}
export async function sendCommercialMessage(raw: unknown) {
  const session = await requireCommercialAccess();
  const row = await enqueue(session.userId, session.userId, raw);
  return dispatchCommercialOutbox(row.id, session.userId);
}
export async function retryCommercialMessage(raw: unknown) {
  const session = await requireCommercialAccess();
  const { id } = z.object({ id: uuid }).strict().parse(raw);
  const [row] = await db
    .select()
    .from(outbox)
    .where(and(eq(outbox.id, id), eq(outbox.ownerId, session.userId)));
  if (!row) throw new CommercialError("Envío no disponible.", 404);
  const c = await ownedConversation(row.conversationId, session.userId);
  // Resend conserva la clave 24 h. Un recibo incierto de WhatsApp exige conciliación.
  const emailRecovery =
    c.channel !== "whatsapp" &&
    Date.now() - row.createdAt.getTime() < 23 * 3600000;
  if (
    row.status !== "failed" &&
    !(
      emailRecovery &&
      ["unknown", "sending"].includes(row.status) &&
      Date.now() - row.updatedAt.getTime() > 60000
    )
  )
    throw new CommercialError(
      "Revisa el recibo del proveedor antes de repetir este envío.",
      409,
    );
  const [reminder] = await db
    .select()
    .from(commercialReminders)
    .where(eq(commercialReminders.outboxId, id));
  if (reminder) {
    if (reminder.status === "paused" || reminder.status === "cancelled")
      throw new CommercialError(
        "Este recordatorio está pausado o cancelado.",
        409,
      );
  }
  const [queued] = await db
    .update(outbox)
    .set({ status: "queued", updatedAt: new Date() })
    .where(and(eq(outbox.id, id), eq(outbox.status, row.status)))
    .returning();
  if (!queued) throw new CommercialError("El envío cambió. Recarga.", 409);
  if (reminder) {
    await db
      .update(commercialReminders)
      .set({ status: "scheduled" })
      .where(eq(commercialReminders.id, reminder.id));
  }
  const result = await dispatchCommercialOutbox(id, session.userId, {
    reminderId: reminder?.id,
  });
  if (reminder)
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
          eq(commercialReminders.id, reminder.id),
          eq(commercialReminders.status, "scheduled"),
        ),
      );
  return result;
}
export async function saveCommercialPolicy(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const data = policyInput.parse(raw);
  if (
    data.automaticEnabled &&
    process.env.COMMERCIAL_AUTOMATION_ENABLED !== "true"
  )
    throw new CommercialError(
      "La activación operativa del asistente requiere COMMERCIAL_AUTOMATION_ENABLED y aprobación humana. Puedes guardar las respuestas con automatización desactivada.",
      409,
    );
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${session.userId + ":policy"},0))`,
    );
    const [current] = await tx
      .select()
      .from(policies)
      .where(eq(policies.ownerId, session.userId))
      .for("update");
    if ((current?.revision || 0) !== data.revision)
      throw new CommercialError("La política cambió. Recarga.", 409);
    await tx
      .insert(policies)
      .values({
        ...data,
        ownerId: session.userId,
        revision: data.revision + 1,
        updatedBy: session.userId,
      })
      .onConflictDoUpdate({
        target: policies.ownerId,
        set: {
          ...data,
          revision: data.revision + 1,
          updatedBy: session.userId,
          updatedAt: new Date(),
        },
      });
    await tx.insert(infraAuditLog).values({
      type:
        "commercial_policy_updated_v" +
        (data.revision + 1) +
        (data.automaticEnabled ? "_enabled" : "_disabled"),
      uid: session.userId,
      route: "/api/commercial",
    });
    await tx
      .insert(commercialPolicyVersions)
      .values({
        ownerId: session.userId,
        revision: data.revision + 1,
        snapshot: {
          automaticEnabled: data.automaticEnabled,
          tone: data.tone,
          approvedAnswers: data.approvedAnswers,
        },
        updatedBy: session.userId,
      });
    return { ok: true };
  });
}
export async function linkCommercialConversation(raw: unknown) {
  const session = await requireCommercialAccess();
  const input = createSelectSchema(conversations)
    .pick({ id: true, clientId: true, revision: true })
    .required()
    .extend({ clientId: uuid, confirmed: z.literal(true) })
    .strict()
    .parse(raw);
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, input.id),
          eq(conversations.ownerId, session.userId),
        ),
      )
      .for("update");
    const [client] = await tx
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, input.clientId),
          eq(clients.ownerId, session.userId),
        ),
      );
    if (!c || !client)
      throw new CommercialError("Contacto o conversación no disponible.", 404);
    if (c.revision !== input.revision)
      throw new CommercialError("La conversación cambió. Recarga.", 409);
    if (c.clientId && c.clientId !== client.id)
      throw new CommercialError(
        "La conversación ya pertenece a otro contacto.",
        409,
      );
    if (c.channel === "whatsapp") await isolatePixelbot(c, session.userId);
    if (c.channel !== "form")
      await tx
        .insert(commercialIdentifiers)
        .values({
          ownerId: session.userId,
          clientId: client.id,
          channel: c.channel,
          value: c.address,
          verifiedAt: new Date(),
          verifiedBy: session.userId,
        })
        .onConflictDoNothing();
    const [identifier] =
      c.channel === "form"
        ? []
        : await tx
            .select()
            .from(commercialIdentifiers)
            .where(
              and(
                eq(commercialIdentifiers.ownerId, session.userId),
                eq(commercialIdentifiers.channel, c.channel),
                eq(commercialIdentifiers.value, c.address),
                sql`${commercialIdentifiers.verifiedAt} is not null`,
              ),
            );
    if (identifier && identifier.clientId !== client.id)
      throw new CommercialError(
        "Este identificador pertenece a otro contacto verificado.",
        409,
      );
    const [newOpportunity] = await tx
      .insert(commercialOpportunities)
      .values({
        ownerId: session.userId,
        clientId: client.id,
        source: c.channel,
        need: c.subject || "Revisar conversación entrante",
        assignedTo: session.userId,
      })
      .onConflictDoNothing()
      .returning();
    const [existing] = newOpportunity
      ? []
      : await tx
          .select()
          .from(commercialOpportunities)
          .where(
            and(
              eq(commercialOpportunities.clientId, client.id),
              eq(commercialOpportunities.ownerId, session.userId),
              sql`${commercialOpportunities.stage} not in ('ganado','perdido')`,
            ),
          );
    await tx
      .update(conversations)
      .set({
        clientId: client.id,
        opportunityId: newOpportunity?.id || existing?.id,
        matchReview: false,
        mode: "HUMAN",
        state: "humano",
        revision: c.revision + 1,
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, c.id));
    await tx.insert(clientActivity).values({
      ownerId: session.userId,
      clientId: client.id,
      type: "commercial_identity",
      actorName: session.email,
      message: "Vinculación manual confirmada de " + c.channel,
      metadata: { conversationId: c.id },
    });
    return { ok: true };
  });
}
export async function synchronizeCommercialWhatsApp(ownerId?: string, raw: unknown = {}) {
  if (!ownerId) ownerId = (await requireCommercialAccess()).userId;
  if (ownerId !== (await commercialInboundOwner()))
    throw new CommercialError("Tenant no asignado a esta cartera.", 403);
  const filter = whatsappSyncInput.parse(raw);
  const { data } = await fetchPixelbot(
    "/internal/conversations?tenant_id=" + encodeURIComponent(tenant()),
    undefined,
    "GET",
  );
  const list = z
    .object({
      conversations: z
        .array(
          z
            .object({ id: z.string().regex(/^\+?[1-9]\d{7,14}$/) })
            .passthrough(),
        )
        .max(1000),
    })
    .parse(data);
  let imported = 0;
  for (const remote of list.conversations) {
    if (filter.address && remote.id !== filter.address) continue;
    const { data: history } = await fetchPixelbot(
      "/internal/conversations/" +
        encodeURIComponent(remote.id) +
        "/messages?tenant_id=" +
        encodeURIComponent(tenant()) +
        "&limit=200",
      undefined,
      "GET",
    );
    for (const m of remoteMessages
      .parse(history)
      .messages.filter((m) => m.direction === "inbound")) {
      const result = await ingestCommercialInbound(ownerId, {
        channel: "whatsapp",
        externalId: remote.id,
        address: remote.id,
        name: remote.id,
        providerId: m.id,
        body: m.text || m.caption || "[Mensaje multimedia]",
        subject: "",
        identifierVerified: true,
        receivedAt: m.createdAt,
      });
      if (!result.repeated) imported++;
      if (
        result.conversation &&
        result.conversation.lastInboundAt?.getTime() === m.createdAt.getTime()
      )
        await runApprovedCommercialReply(
          result.conversation,
          m.text || m.caption || "[Mensaje multimedia]",
          m.id,
        );
    }
  }
  return { ok: true, imported };
}
export async function runApprovedCommercialReply(
  c: Conversation,
  body: string,
  providerId: string,
) {
  if (process.env.COMMERCIAL_AUTOMATION_ENABLED !== "true") return;
  const [policy] = await db
    .select()
    .from(policies)
    .where(eq(policies.ownerId, c.ownerId));
  const decision = approvedReply({
    body,
    enabled: policy?.automaticEnabled || false,
    mode: c.mode,
    needsReview: c.matchReview,
    answers: policy?.approvedAnswers || [],
  });
  if (!decision.reply) {
    if (c.mode === "BOT")
      await db
        .update(conversations)
        .set({
          state: "decision",
          mode: "HUMAN",
          revision: sql`${conversations.revision}+1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.id, c.id),
            eq(conversations.mode, "BOT"),
            eq(conversations.revision, c.revision),
          ),
        );
    return;
  }
  const row = await enqueue(c.ownerId, c.ownerId, {
    conversationId: c.id,
    idempotencyKey: eventKey("reply:" + c.id + ":" + providerId),
    body: decision.reply,
    subject: c.subject,
  });
  return dispatchCommercialOutbox(row.id, c.ownerId, {
    automatic: true,
    inboundAt: c.lastInboundAt,
    policyRevision: policy?.revision,
  });
}
export async function verifyCommercialConnections() {
  const session = await requireCommercialAccess(true);
  const email = await verifyCommercialEmailDomain();
  let whatsapp = {
    verified: false,
    reason:
      "Configura el tenant, la URL y el secreto interno de PixelBot; habilita egress de lectura hacia el destino aprobado.",
  };
  try {
    if (session.userId !== (await commercialInboundOwner()))
      throw new Error("owner");
    const { data } = await fetchPixelbot(
      "/internal/conversations?tenant_id=" + encodeURIComponent(tenant()),
      undefined,
      "GET",
    );
    z.object({ conversations: z.array(z.unknown()) }).parse(data);
    const phone = await getPhoneNumberInfo();
    const connected = phone.connectionStatus === "CONNECTED";
    whatsapp = {
      verified: connected,
      reason:
        connected
          ? "Número conectado en Meta y API de historial de PixelBot disponible. El envío requiere permisos, destinatario autorizado y ventana vigente."
          : "PixelBot responde; comprueba la conexión del número y los permisos en Meta.",
    };
  } catch {
    /* Estado pendiente explícito; nunca conectado por presencia de env. */
  }
  const [receipt] = await db
    .select({ id: commercialWebhookEvents.id })
    .from(commercialWebhookEvents)
    .where(
      and(
        eq(commercialWebhookEvents.provider, "resend_verified_inbound"),
        eq(commercialWebhookEvents.status, "done"),
        sql`${commercialWebhookEvents.processedAt}>now()-interval '7 days'`,
      ),
    )
    .limit(1);
  const receivingVerified =
    !!receipt && process.env.COMMERCIAL_EMAIL_RECEIVING_ENABLED === "true";
  const [worker] = await db
    .select({ createdAt: infraAuditLog.createdAt })
    .from(infraAuditLog)
    .where(
      and(
        eq(infraAuditLog.uid, session.userId),
        eq(infraAuditLog.type, "commercial_worker_completed"),
      ),
    )
    .orderBy(sql`${infraAuditLog.createdAt} desc`)
    .limit(1);
  const workerRecent =
    !!worker && Date.now() - worker.createdAt.getTime() < 300000;
  return {
    scheduledWork: {
      verified: workerRecent,
      reason: workerRecent
        ? "El proceso de sincronización completó una ejecución durante los últimos cinco minutos. Cada canal se verifica por separado."
        : "Configura una llamada autenticada cada minuto a /api/cron/commercial; falta una ejecución completa reciente.",
    },
    whatsappAutomation: {
      verified: false,
      reason:
        process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE === "true"
          ? "Emisor único declarado. La aprobación de la política y una prueba controlada de pausa y respuesta completan la verificación."
          : "Confirma el traspaso desde el bot anterior antes de habilitar COMMERCIAL_WHATSAPP_EXCLUSIVE. No habilita envíos por sí solo.",
    },
    reminders: {
      verified:
        workerRecent && process.env.COMMERCIAL_REMINDERS_ENABLED === "true",
      reason:
        process.env.COMMERCIAL_REMINDERS_ENABLED === "true"
          ? "Programación habilitada; verifica el proceso y un recibo con destinatario de prueba. La cartera se excluye de los cron anteriores."
          : "Los recordatorios programados requieren aprobación, traspaso de la cartera y COMMERCIAL_REMINDERS_ENABLED. Los envíos manuales conservan su confirmación.",
    },
    checkedAt: new Date().toISOString(),
    email,
    whatsapp,
    receiving: {
      verified: receivingVerified,
      reason: receivingVerified
        ? "Recepción comprobada con un evento firmado y persistido durante los últimos siete días."
        : process.env.COMMERCIAL_EMAIL_RECEIVING_ENABLED === "true"
          ? "Recepción configurada: verifica con un evento firmado de un destinatario de prueba."
          : "Configura RESEND_WEBHOOK_SECRET, dominio receptor y COMMERCIAL_EMAIL_RECEIVING_ENABLED en el gestor de secretos.",
    },
    automation: {
      enabled: process.env.COMMERCIAL_AUTOMATION_ENABLED === "true",
      reason:
        "La política aprobada y la reactivación explícita de cada conversación controlan las respuestas.",
    },
  };
}
