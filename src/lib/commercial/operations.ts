import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  commercialOpportunities,
  commercialIdentifiers,
  projects,
  quotes,
  users,
  clientActivity,
  clientPortalUpdates,
} from "@/lib/db/schema";
import {
  resolveOwnedClientPgId,
  resolveOwnedProjectPgId,
} from "@/lib/documents/pg";
import { contactInput, opportunityInput, projectInput } from "./schemas";
import { CommercialError, requireCommercialAccess } from "./access";

export async function createCommercialContact(raw: unknown) {
  const session = await requireCommercialAccess();
  const data = contactInput.parse(raw);
  return db.transaction(async (tx) => {
    // Serializa identificadores iguales sin confiar en que la coincidencia
    // corresponda a la misma persona. No fusiona nombres ni dominios parecidos.
    const key =
      data.email?.toLowerCase() || data.phone || data.name.toLowerCase();
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${session.userId + ":" + key}, 0))`,
    );
    const candidates = await tx
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(
        and(
          eq(clients.ownerId, session.userId),
          or(
            data.email
              ? sql`lower(${clients.email}) = ${data.email.toLowerCase()}`
              : sql`false`,
            data.phone ? eq(clients.phone, data.phone) : sql`false`,
            !data.email && !data.phone
              ? eq(clients.name, data.name)
              : sql`false`,
          ),
        ),
      );
    if (candidates.length) return { needsReview: true as const, candidates };
    const newId = randomUUID();
    const [client] = await tx
      .insert(clients)
      .values({
        id: newId,
        firestoreId: newId,
        ownerId: session.userId,
        source: "crm_blob",
        name: data.name,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        notes: data.notes ?? "",
      })
      .returning({ id: clients.id });
    const [opportunity] = await tx
      .insert(commercialOpportunities)
      .values({
        ownerId: session.userId,
        clientId: client.id,
        assignedTo: session.userId,
        source: data.source,
        need: data.need,
      })
      .returning({ id: commercialOpportunities.id });
    for (const channel of ["email", "whatsapp"] as const) {
      const value =
        channel === "email" ? data.email?.toLowerCase() : data.phone;
      if (value)
        await tx.insert(commercialIdentifiers).values({
          ownerId: session.userId,
          clientId: client.id,
          channel,
          value,
        });
    }
    await tx.insert(clientActivity).values({
      ownerId: session.userId,
      clientId: client.id,
      type: "cliente_creado",
      message: "Contacto y oportunidad creados",
      actorName: session.email,
      metadata: { opportunityId: opportunity.id },
    });
    return {
      needsReview: false as const,
      clientId: client.id,
      opportunityId: opportunity.id,
    };
  });
}

export async function updateCommercialOpportunity(raw: unknown) {
  const session = await requireCommercialAccess();
  const data = opportunityInput.parse(raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(commercialOpportunities)
      .where(
        and(
          eq(commercialOpportunities.id, data.id),
          eq(commercialOpportunities.ownerId, session.userId),
        ),
      )
      .for("update");
    if (!row)
      throw new CommercialError("La oportunidad no está disponible.", 404);
    if (row.revision !== data.revision)
      throw new CommercialError(
        "La oportunidad cambió. Recarga antes de guardar.",
        409,
      );
    if (
      (data.stage === "pausado" || data.stage === "perdido") &&
      !data.reason?.trim()
    )
      throw new CommercialError(
        "Escribe el motivo para conservarlo en el historial.",
      );
    if (data.assignedTo && data.assignedTo !== session.userId) {
      // La cartera sigue aislada por owner (ADR0036). No se transfiere por
      // seleccionar un usuario de otra cartera.
      throw new CommercialError(
        "La asignación a otra cartera requiere transferencia administrativa.",
      );
    }
    if (data.quoteId) {
      const [quote] = await tx
        .select({ id: quotes.id, status: quotes.status })
        .from(quotes)
        .where(
          and(eq(quotes.id, data.quoteId), eq(quotes.clientId, row.clientId)),
        );
      if (!quote)
        throw new CommercialError(
          "La cotización no pertenece a este contacto.",
        );
      if (data.stage === "ganado" && quote.status !== "aceptada")
        throw new CommercialError(
          "Confirma la aceptación de la cotización antes de marcar la venta ganada.",
        );
    } else if (data.stage === "ganado")
      throw new CommercialError(
        "Vincula una cotización aceptada antes de marcar la venta ganada.",
      );
    const { id, revision, ...fields } = data;
    await tx
      .update(commercialOpportunities)
      .set({ ...fields, revision: revision + 1, updatedAt: new Date() })
      .where(eq(commercialOpportunities.id, id));
    await tx.insert(clientActivity).values({
      ownerId: session.userId,
      clientId: row.clientId,
      type: "seguimiento",
      message: `Oportunidad: ${saleStageLabel[data.stage ?? row.stage]}`,
      actorName: session.email,
      metadata: {
        opportunityId: id,
        from: row.stage,
        to: data.stage,
        nextAction: data.nextAction,
        nextActionDue: data.nextActionDue,
        revision: revision + 1,
      },
    });
    return { id, revision: revision + 1 };
  });
}

export async function updateCommercialProject(raw: unknown) {
  const session = await requireCommercialAccess();
  const data = projectInput.parse(raw);
  const id = await resolveOwnedProjectPgId(data.id, session.userId);
  if (!id) throw new CommercialError("El proyecto no está disponible.", 404);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .for("update");
    if (row.commercialRevision !== data.commercialRevision)
      throw new CommercialError(
        "El proyecto cambió. Recarga antes de guardar.",
        409,
      );
    const { id: _id, commercialRevision, ...fields } = data;
    await tx
      .update(projects)
      .set({ ...fields, commercialRevision: commercialRevision + 1 })
      .where(eq(projects.id, id));
    await tx.insert(clientActivity).values({
      ownerId: session.userId,
      clientId: row.clientId,
      type: "actualizacion_comercial",
      message: `Proyecto ${row.name}: ${projectStageLabel[data.commercialStage]}`,
      actorName: session.email,
      metadata: {
        projectId: id,
        from: row.commercialStage,
        ...fields,
        revision: commercialRevision + 1,
      },
    });
    // Publicación explícita de la nota en el portal existente. Se conserva
    // historia; no se exponen cuentas, prompts, readme ni notas internas.
    if (data.clientNote.trim())
      await tx.insert(clientPortalUpdates).values({
        clientId: row.clientId,
        text: `${row.name}\n${data.clientNote}${data.nextStep ? "\nSiguiente paso: " + data.nextStep : ""}${data.nextStepDue ? " · " + data.nextStepDue : ""}`,
        createdBy: session.userId,
      });
    return { id, revision: commercialRevision + 1 };
  });
}

export async function createOpportunityForClient(
  clientId: string,
  need: string,
) {
  const session = await requireCommercialAccess();
  const id = await resolveOwnedClientPgId(clientId, session.userId);
  if (!id) throw new CommercialError("El cliente no está disponible.", 404);
  const fields = contactInput.pick({ need: true }).parse({ need });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(commercialOpportunities)
      .values({
        clientId: id,
        ownerId: session.userId,
        assignedTo: session.userId,
        source: "manual",
        need: fields.need,
      })
      .onConflictDoNothing()
      .returning({ id: commercialOpportunities.id });
    if (row) {
      await tx
        .insert(clientActivity)
        .values({
          ownerId: session.userId,
          clientId: id,
          type: "commercial_opportunity",
          actorName: session.email,
          message: "Oportunidad comercial creada",
          metadata: { opportunityId: row.id, source: "manual" },
        });
      return row;
    }
    const [existing] = await tx
      .select({ id: commercialOpportunities.id })
      .from(commercialOpportunities)
      .where(
        and(
          eq(commercialOpportunities.clientId, id),
          eq(commercialOpportunities.ownerId, session.userId),
          sql`${commercialOpportunities.stage} not in ('ganado','perdido')`,
        ),
      );
    return existing;
  });
}
import { projectStageLabel, saleStageLabel } from "./model";
