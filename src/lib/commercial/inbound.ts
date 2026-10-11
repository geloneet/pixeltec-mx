import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  users,
  commercialConversations,
  commercialIdentifiers,
  commercialOpportunities,
  commercialMessages,
  commercialWebhookEvents,
  clientActivity,
} from "@/lib/db/schema";
import { inboundInput, uuid } from "./schemas";
import { CommercialError } from "./access";

export async function commercialInboundOwner() {
  const parsed = uuid.safeParse(process.env.COMMERCIAL_OWNER_ID);
  if (!parsed.success)
    throw new CommercialError(
      "Configura COMMERCIAL_OWNER_ID con el administrador de la cartera.",
      503,
    );
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.id, parsed.data),
        eq(users.role, "admin"),
        eq(users.status, "active"),
      ),
    );
  if (!owner)
    throw new CommercialError(
      "El responsable comercial debe ser un administrador activo.",
      503,
    );
  return owner.id;
}

/** Solo adaptadores autenticados pueden invocarlo; no es una server action. */
export async function ingestCommercialInbound(ownerId: string, raw: unknown) {
  uuid.parse(ownerId);
  const data = inboundInput.parse(raw);
  if (data.receivedAt.getTime() > Date.now() + 300000)
    throw new CommercialError("Fecha del proveedor inválida.");
  const address =
    data.channel === "email" ? data.address.trim().toLowerCase() : data.address;
  if (data.channel === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
    throw new CommercialError("Dirección de remitente inválida.");
  if (data.channel === "whatsapp" && !/^\+?[1-9]\d{7,14}$/.test(address))
    throw new CommercialError("Teléfono del proveedor inválido.");
  const eventId = data.channel + ":" + ownerId + ":" + data.providerId;
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`,
    );
    const [event] = await tx
      .select()
      .from(commercialWebhookEvents)
      .where(eq(commercialWebhookEvents.id, eventId));
    if (event) {
      if (event.payloadHash !== payloadHash)
        throw new CommercialError(
          "El evento repetido cambió su contenido.",
          409,
        );
      const [conversation] = await tx
        .select()
        .from(commercialConversations)
        .where(
          and(
            eq(commercialConversations.ownerId, ownerId),
            eq(commercialConversations.channel, data.channel),
            eq(commercialConversations.externalId, data.externalId),
          ),
        );
      return { conversation, repeated: true };
    }
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${ownerId + ":" + data.channel + ":" + address}, 0))`,
    );
    let [conversation] = await tx
      .select()
      .from(commercialConversations)
      .where(
        and(
          eq(commercialConversations.ownerId, ownerId),
          eq(commercialConversations.channel, data.channel),
          eq(commercialConversations.externalId, data.externalId),
        ),
      )
      .for("update");
    if (!conversation) {
      let clientId: string | null = null;
      let review = false;
      if (data.identifierVerified && data.channel !== "form") {
        const [verified] = await tx
          .select({ clientId: commercialIdentifiers.clientId })
          .from(commercialIdentifiers)
          .where(
            and(
              eq(commercialIdentifiers.ownerId, ownerId),
              eq(commercialIdentifiers.channel, data.channel),
              eq(commercialIdentifiers.value, address),
              sql`${commercialIdentifiers.verifiedAt} is not null`,
            ),
          );
        clientId = verified?.clientId ?? null;
      }
      if (!clientId) {
        const candidates = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.ownerId, ownerId),
              or(
                data.channel !== "whatsapp"
                  ? sql`lower(${clients.email}) = ${address}`
                  : sql`false`,
                data.channel === "whatsapp"
                  ? or(
                      eq(clients.phone, address),
                      eq(clients.whatsapp, address),
                    )
                  : sql`false`,
              ),
            ),
          )
          .limit(2);
        review = candidates.length > 0;
        if (!review) {
          const newId = randomUUID();
          const [created] = await tx
            .insert(clients)
            .values({
              id: newId,
              firestoreId: newId,
              ownerId,
              source: "crm_blob",
              name: data.name,
              email: data.channel !== "whatsapp" ? address : null,
              phone: data.channel === "whatsapp" ? address : null,
            })
            .returning({ id: clients.id });
          clientId = created.id;
          if (data.channel !== "form")
            await tx.insert(commercialIdentifiers).values({
              ownerId,
              clientId,
              channel: data.channel,
              value: address,
              verifiedAt: data.identifierVerified ? new Date() : null,
              verifiedBy: data.identifierVerified
                ? "authenticated_provider"
                : null,
            });
        }
      }
      let opportunityId: string | null = null;
      if (clientId) {
        const [created] = await tx
          .insert(commercialOpportunities)
          .values({
            ownerId,
            clientId,
            assignedTo: ownerId,
            source: data.channel,
            need: data.body.slice(0, 2000),
          })
          .onConflictDoNothing()
          .returning({ id: commercialOpportunities.id });
        const [existing] = created
          ? []
          : await tx
              .select({ id: commercialOpportunities.id })
              .from(commercialOpportunities)
              .where(
                and(
                  eq(commercialOpportunities.ownerId, ownerId),
                  eq(commercialOpportunities.clientId, clientId),
                  sql`${commercialOpportunities.stage} not in ('ganado','perdido')`,
                ),
              );
        opportunityId = created?.id ?? existing?.id ?? null;
      }
      [conversation] = await tx
        .insert(commercialConversations)
        .values({
          ownerId,
          clientId,
          opportunityId,
          channel: data.channel,
          externalId: data.externalId,
          address,
          subject: data.subject,
          matchReview: review,
          mode: "HUMAN",
          state: review ? "decision" : "sin_atender",
          lastInboundAt: data.receivedAt,
        })
        .returning();
    }
    // WhatsApp conserva mensajes únicamente en PixelBot. Aquí se deduplica el
    // evento comercial, sin introducir otro historial ni un segundo bot.
    if (data.channel !== "whatsapp")
      await tx
        .insert(commercialMessages)
        .values({
          conversationId: conversation.id,
          providerId: data.providerId,
          direction: "inbound",
          body: data.body,
          delivery: "received",
          createdAt: data.receivedAt,
        })
        .onConflictDoNothing();
    const [updated] = await tx
      .update(commercialConversations)
      .set({
        lastInboundAt:
          conversation.lastInboundAt &&
          conversation.lastInboundAt > data.receivedAt
            ? conversation.lastInboundAt
            : data.receivedAt,
        revision: sql`${commercialConversations.revision}+1`,
        state: conversation.matchReview
          ? "decision"
          : conversation.state === "humano"
            ? "humano"
            : "sin_atender",
        updatedAt: new Date(),
      })
      .where(eq(commercialConversations.id, conversation.id))
      .returning();
    if (conversation.clientId)
      await tx.insert(clientActivity).values({
        ownerId,
        clientId: conversation.clientId,
        type: "mensaje_entrante",
        message: `Mensaje recibido por ${data.channel}`,
        actorName: data.name,
        metadata: {
          conversationId: conversation.id,
          providerId: data.providerId,
        },
      });
    await tx.insert(commercialWebhookEvents).values({
      id: eventId,
      provider: data.channel,
      payloadHash,
      status: "done",
      processedAt: new Date(),
    });
    return { conversation: updated, repeated: false };
  });
}
