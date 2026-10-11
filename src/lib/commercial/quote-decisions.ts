import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  quotes,
  quoteVersions,
  quoteDecisions,
  clients,
  clientActivity,
} from "@/lib/db/schema";
import { toQuoteRecord } from "@/lib/quotes/queries";
import { missingToSend } from "@/lib/quotes/terms";
import { decisionInput } from "./schemas";
import { CommercialError } from "./access";

const tokenInput = z.string().regex(/^[A-Za-z0-9_-]{32}$/);
export async function recordQuoteDecision(token: string, raw: unknown) {
  tokenInput.parse(token);
  const data = decisionInput.parse(raw);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(quotes)
      .where(eq(quotes.publicToken, token))
      .for("update");
    if (!row || row.status === "borrador")
      throw new CommercialError("La cotización no está disponible.", 404);
    if (row.version !== data.version)
      throw new CommercialError(
        "Hay una versión nueva. Recarga y revísala antes de decidir.",
        409,
      );
    const [existing] = await tx
      .select()
      .from(quoteDecisions)
      .where(
        and(
          eq(quoteDecisions.quoteId, row.id),
          eq(quoteDecisions.version, data.version),
        ),
      );
    if (existing) {
      if (
        existing.decision !== data.decision ||
        existing.actorName !== data.actorName ||
        existing.comment !== data.comment
      )
        throw new CommercialError(
          "Esta versión ya tiene una decisión registrada.",
          409,
        );
      return {
        decision: existing.decision,
        createdAt: existing.createdAt.toISOString(),
        repeated: true,
      };
    }
    if (["aceptada", "rechazada"].includes(row.status))
      throw new CommercialError("Esta cotización ya está cerrada.", 409);
    if (!row.validUntil || row.validUntil.getTime() < Date.now())
      throw new CommercialError(
        "La vigencia terminó. Solicita una cotización actualizada.",
        409,
      );
    const quote = toQuoteRecord(row);
    if (!quote || missingToSend(quote).length)
      throw new CommercialError("La cotización aún no está completa.", 409);
    if (data.decision === "changes" && !data.comment)
      throw new CommercialError("Describe el cambio que necesitas.");
    await tx
      .insert(quoteVersions)
      .values({
        quoteId: row.id,
        version: row.version,
        snapshot: row,
        createdBy: row.createdBy,
      })
      .onConflictDoNothing();
    const [decision] = await tx
      .insert(quoteDecisions)
      .values({ quoteId: row.id, ...data })
      .returning();
    const [client] = await tx
      .select({ ownerId: clients.ownerId })
      .from(clients)
      .where(eq(clients.id, row.clientId));
    if (data.decision === "accept")
      await tx
        .update(quotes)
        .set({ status: "aceptacion_pendiente", updatedAt: new Date() })
        .where(eq(quotes.id, row.id));
    await tx.insert(clientActivity).values({
      ownerId: client.ownerId,
      clientId: row.clientId,
      type:
        data.decision === "accept"
          ? "cotizacion_aceptada_cliente"
          : "cotizacion_cambios_solicitados",
      message: `${row.folio} versión ${row.version}: ${data.decision === "accept" ? "aceptación pendiente de confirmación administrativa" : "cambios solicitados"}`,
      actorName: data.actorName,
      metadata: {
        quoteId: row.id,
        version: row.version,
        decisionId: decision.id,
        comment: data.comment,
        authentication: "quote_bearer_link",
      },
    });
    // El enlace acredita acceso al documento; el nombre es declaración del
    // firmante, no una identidad legal verificada. Se conserva ese alcance.
    return {
      decision: decision.decision,
      createdAt: decision.createdAt.toISOString(),
      repeated: false,
    };
  });
}
