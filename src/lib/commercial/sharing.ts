import "server-only";
import { projectStageLabel } from "./model";
import { and, eq, sql } from "drizzle-orm";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  projects,
  clients,
  quotes,
  commercialConversations,
  commercialOpportunities,
  clientActivity,
} from "@/lib/db/schema";
import { getOwnedQuoteById } from "@/lib/quotes/queries";
import { missingToSend, firstFollowUp } from "@/lib/quotes/terms";
import { SITE } from "@/lib/site-config";
import { requireCommercialAccess, CommercialError } from "./access";
import { uuid } from "./schemas";
import { sendCommercialMessage } from "./inbox";
const shareInput = createSelectSchema(projects)
  .pick({ id: true })
  .extend({
    conversationId: uuid,
    idempotencyKey: uuid,
    expectedRevision: z.number().int().min(1),
  })
  .strict();
export async function shareCommercialProject(raw: unknown) {
  const session = await requireCommercialAccess();
  const input = shareInput.parse(raw);
  const [row] = await db
    .select({ project: projects, enabled: clients.portalAccessEnabled })
    .from(projects)
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(and(eq(projects.id, input.id), eq(clients.ownerId, session.userId)));
  if (!row) throw new CommercialError("Proyecto no disponible.", 404);
  if (row.project.commercialRevision !== input.expectedRevision)
    throw new CommercialError(
      "El avance cambió. Revisa la versión actual.",
      409,
    );
  if (!row.enabled)
    throw new CommercialError(
      "Activa el portal desde la ficha del cliente antes de compartir su acceso.",
    );
  const [c] = await db
    .select()
    .from(commercialConversations)
    .where(
      and(
        eq(commercialConversations.id, input.conversationId),
        eq(commercialConversations.ownerId, session.userId),
        eq(commercialConversations.clientId, row.project.clientId),
      ),
    );
  if (!c) throw new CommercialError("Elige una conversación del cliente.");
  const p = row.project;
  const body =
    p.name +
    "\n" +
    projectStageLabel[p.commercialStage] +
    "\n\n" +
    p.clientNote +
    "\n\nPróximo paso: " +
    (p.nextStep || "Por definir") +
    (p.nextStepDue ? " · " + p.nextStepDue : "") +
    "\n\nConsulta tu portal: " +
    SITE.url +
    "/portal";
  const result = await sendCommercialMessage({
    conversationId: c.id,
    idempotencyKey: input.idempotencyKey,
    body,
    subject: "Avance de " + p.name,
  });
  if (["sent", "delivered"].includes(result.status))
    await db
      .insert(clientActivity)
      .values({
        // The durable outbox UUID also identifies its single activity receipt.
        // A replay after a lost response repairs the receipt without adding history.
        id: result.id,
        ownerId: session.userId,
        clientId: p.clientId,
        type: "commercial_project_shared",
        actorName: session.email,
        message: "Avance compartido por " + c.channel,
        metadata: {
          projectId: p.id,
          revision: p.commercialRevision,
          outboxId: result.id,
        },
      })
      .onConflictDoNothing({ target: clientActivity.id });
  return result;
}
export async function shareCommercialQuote(raw: unknown) {
  const session = await requireCommercialAccess(true);
  const input = shareInput.parse(raw);
  const q = await getOwnedQuoteById(input.id, session.userId);
  if (!q) throw new CommercialError("Cotización no disponible.", 404);
  if (q.version !== input.expectedRevision)
    throw new CommercialError(
      "La cotización cambió. Revisa la versión actual.",
      409,
    );
  if (
    ["aceptada", "aceptacion_pendiente", "rechazada"].includes(q.status) ||
    missingToSend(q).length ||
    !q.validUntil ||
    new Date(q.validUntil).getTime() < Date.now()
  )
    throw new CommercialError(
      "Revisa el estado, la vigencia y los datos antes de compartir.",
    );
  const [c] = await db
    .select()
    .from(commercialConversations)
    .where(
      and(
        eq(commercialConversations.id, input.conversationId),
        eq(commercialConversations.ownerId, session.userId),
        eq(commercialConversations.clientId, q.clientId),
      ),
    );
  if (!c) throw new CommercialError("Elige una conversación del cliente.");
  const result = await sendCommercialMessage({
    conversationId: c.id,
    idempotencyKey: input.idempotencyKey,
    body:
      "Tu cotización " +
      q.folio +
      " · " +
      q.title +
      "\nVersión " +
      q.version +
      "\n\nRevisa la propuesta y acepta o solicita cambios desde tu enlace protegido:\n" +
      SITE.url +
      "/c/" +
      q.publicToken,
    subject: "Cotización " + q.folio + " · PixelTEC",
  });
  if (["sent", "delivered"].includes(result.status)) {
    const now = new Date();
    await db
      .update(quotes)
      .set({
        status: "enviada",
        sentAt: now,
        nextFollowUpAt: firstFollowUp(now),
        updatedAt: now,
      })
      .where(
        and(
          eq(quotes.id, q.id),
          eq(quotes.version, q.version),
          sql`${quotes.status} not in ('aceptada','aceptacion_pendiente','rechazada')`,
        ),
      );
  }
  return result;
}
export async function openCommercialEmailConversation(raw: unknown) {
  const session = await requireCommercialAccess();
  const { clientId } = z.object({ clientId: uuid }).strict().parse(raw);
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.ownerId, session.userId)));
  if (
    !client ||
    !client.email ||
    !z.string().email().safeParse(client.email).success
  )
    throw new CommercialError(
      "Registra un correo válido en la ficha del cliente.",
    );
  const address = client.email.trim().toLowerCase();
  const [opportunity] = await db
    .select({ id: commercialOpportunities.id })
    .from(commercialOpportunities)
    .where(
      and(
        eq(commercialOpportunities.ownerId, session.userId),
        eq(commercialOpportunities.clientId, clientId),
        sql`${commercialOpportunities.stage} not in ('ganado','perdido')`,
      ),
    );
  const [created] = await db
    .insert(commercialConversations)
    .values({
      ownerId: session.userId,
      clientId,
      opportunityId: opportunity?.id,
      channel: "email",
      address,
      externalId: address,
      subject: "Atención comercial",
      mode: "HUMAN",
      state: "humano",
    })
    .onConflictDoNothing()
    .returning();
  const [existing] = created
    ? []
    : await db
        .select()
        .from(commercialConversations)
        .where(
          and(
            eq(commercialConversations.ownerId, session.userId),
            eq(commercialConversations.channel, "email"),
            eq(commercialConversations.externalId, address),
          ),
        );
  if (!created && (existing.clientId !== clientId || existing.matchReview))
    throw new CommercialError(
      "Revisa la vinculación del contacto desde Conversaciones.",
      409,
    );
  return { ok: true, id: created?.id || existing.id };
}
