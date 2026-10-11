'use server';

/**
 * Server Actions de cotizaciones (WO-2026-00101).
 *
 * Sin IA en ningún punto: la cotización la escribe Miguel.
 *
 * Permisos: crear y editar exigen sesión; **enviar exige rol administrador**,
 * porque un envío sale de la casa y llega a un cliente real. El envío nunca es
 * automático: siempre lo dispara una acción explícita.
 */
import { and, eq, sql } from 'drizzle-orm';
import { createInsertSchema } from 'drizzle-zod';
import { randomUUID, randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { firstAnniversary } from '@/lib/sales/model';
import { quotes, quoteVersions, commercialOpportunities, clientActivity, commercialCommands } from '@/lib/db/schema';
import { eventKey } from '@/lib/commercial/inbox';
import { requireCommercialAccess } from '@/lib/commercial/access';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { toPublicFailure } from '@/lib/errors/public-failure';
import type { ActionResult } from '@/lib/blog/schemas';
import { sendEmail } from '@/lib/email';
import { SITE } from '@/lib/site-config';
import {
  RECURRENCES,
  RECURRENCE_TOTAL_LABEL,
  computeBreakdown,
  usableItems,
  validateQuote,
  type QuoteItem,
} from './money';
import {
  CURRENCIES,
  DEFAULT_EXCLUSIONS,
  DEFAULT_PAYMENT_TERMS,
  PAYMENT_TYPES,
  REJECTION_REASONS,
  defaultValidUntil,
  displayStatus,
  firstFollowUp,
  firstInstalment,
  formatAmountWithCode,
  formatDate,
  missingToSend,
  nextFollowUp,
  parsePaymentTerms,
  type PaymentTerms,
} from './terms';
import { createChargeFromQuote, toBillingFrequency } from './billing-bridge';
import { acceptQuoteAndCreateSale } from '@/lib/sales/accept';
import { ACCEPTED_VIA } from '@/lib/sales/model';
import { nextFolio } from './folio';
import { buildEmailSubject } from './share';
import { getOwnedQuoteById, getQuoteClient, listFolios } from './queries';
import { resolveOwnedClientPgId } from '@/lib/documents/pg';
import { renderQuoteEmailHtml } from './email-html';
import { renderQuotePdf } from './pdf';

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  // Un `ZodError` a secas en el log no dice nada: se registra QUÉ campo falló
  // (ruta y motivo, nunca el valor) para poder diagnosticar sin adivinar.
  const detail =
    err instanceof z.ZodError
      ? err.issues.map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`).join(' · ')
      : err instanceof Error
        ? err.name
        : typeof err;
  console.error(`[quotes] ${code}:`, detail);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

const ItemSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(999_999_999),
  // Ausente ⇒ pago único: las cotizaciones guardadas antes de esta orden no lo
  // traen y deben seguir guardándose sin tocar nada.
  recurrence: z.enum(RECURRENCES).optional(),
  // Sin esta línea zod BORRA la bandera en silencio —`z.object` descarta las
  // claves que no declara— y «primer año gratis» se guardaría como una anual
  // normal: el total inicial subiría 899 al reabrir. Mismo fallo que ya pasó
  // con `recurrence` el 2026-08-26, ahora con el saneador de escritura.
  firstYearFree: z.boolean().optional(),
});

const SaveQuoteSchema = createInsertSchema(quotes, {
  id: z.string().uuid().optional(),
  // OJO: es el id PÚBLICO del cliente (ADR-0035), no el uuid de Postgres.
  // La pantalla de cliente vive en /clientes/<publicId>. Se resuelve abajo.
  clientId: z.string().min(1).max(64),
  title: z.string().max(200),
  items: z.array(ItemSchema).max(100),
  taxEnabled: z.boolean(),
  notes: z.string().max(5000),
  validUntil: z.string().max(40).nullable(),
  // ── MVP comercial (WO-2026-00104) ────────────────────────────────────────
  currency: z.enum(CURRENCIES),
  problem: z.string().max(4000),
  solution: z.string().max(4000),
  scopeIncluded: z.string().max(4000),
  exclusions: z.string().max(4000),
  estimatedDelivery: z.string().max(200),
  paymentTerms: z.object({ type: z.enum(PAYMENT_TYPES), custom: z.string().max(2000) }),
  // WO-2026-00255 (revierte la decisión de Miguel del 2026-08-26 de fundir
  // «Guardar borrador»/«Crear cotización» en un solo botón — pedido explícito
  // de Miguel: quiere el botón separado de vuelta). `true` = "Crear
  // cotización" (avanza de borrador a lista); ausente/false = "Guardar
  // borrador" (se queda en borrador). Nunca retrocede un estado ya avanzado.
}).pick({ id: true, clientId: true, title: true, items: true, taxEnabled: true, notes: true, validUntil: true, currency: true, problem: true, solution: true, scopeIncluded: true, exclusions: true, estimatedDelivery: true, paymentTerms: true }).extend({ markReady: z.boolean().optional(), expectedVersion: z.number().int().min(1).optional() }).strict();
export type SaveQuoteInput = z.infer<typeof SaveQuoteSchema>;

/**
 * La pestaña recarga sus datos llamando a `listQuotesAction`, no por caché de
 * ruta. Se revalida solo `/clientes` — interpolar aquí el id sería mentira: en
 * unos sitios se tiene el id público (el de la URL) y en otros el uuid de
 * Postgres, y la ruta solo existe con el primero.
 */
function revalidateClient(_clientId: string) {
  revalidatePath('/clientes');
}

/** Crea o actualiza una cotización. Devuelve su id. */
export async function saveQuote(input: SaveQuoteInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await requireCommercialAccess();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };

    const data = SaveQuoteSchema.parse(input);
    const clientPgId = await resolveOwnedClientPgId(data.clientId, session.userId);
    if (!clientPgId) return { ok: false, error: 'No se encontró el cliente.' };

    const items: QuoteItem[] = usableItems(data.items);

    const issues = validateQuote({ title: data.title, items, validUntil: data.validUntil });
    if (issues.length > 0) return { ok: false, error: issues[0].message };

    const validUntil = data.validUntil ? new Date(data.validUntil) : null;

    if (data.id) {
      if (!data.expectedVersion) return {ok:false,error:'Recarga la cotización antes de editar: falta su versión.'};
      const existing = await getOwnedQuoteById(data.id, session.userId);
      if (!existing) return { ok: false, error: 'La cotización ya no existe.' };
      // §2: una cotización aceptada es evidencia comercial de lo que el cliente
      // aceptó. No se edita en silencio; si hay que cambiar la propuesta, se
      // hace otra cotización.
      if (['aceptada', 'aceptacion_pendiente'].includes(existing.status)) {
        return {
          ok: false,
          error:
            'Esta cotización ya fue aceptada: es el documento que aceptó el cliente. Crea una nueva si cambian las condiciones.',
        };
      }
      await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(quotes).where(eq(quotes.id, data.id!)).for('update');
        if (locked.version !== (data.expectedVersion ?? existing.version) || ['aceptada', 'aceptacion_pendiente'].includes(locked.status)) {
          throw new Error('quote_version_conflict');
        }
        if (locked.clientId !== clientPgId) throw new Error('quote_client_immutable');
        await tx.insert(quoteVersions).values({ quoteId: locked.id, version: locked.version, snapshot: locked, createdBy: session.userId }).onConflictDoNothing();
        const [updated] = await tx.update(quotes).set({
          version: locked.version + 1,
          title: data.title.trim(),
          items,
          taxEnabled: data.taxEnabled,
          notes: data.notes.trim(),
          validUntil,
          currency: data.currency,
          problem: data.problem.trim(),
          solution: data.solution.trim(),
          scopeIncluded: data.scopeIncluded.trim(),
          exclusions: data.exclusions.trim(),
          estimatedDelivery: data.estimatedDelivery.trim(),
          paymentTerms: data.paymentTerms,
          // Solo avanza (borrador -> lista) con "Crear cotización"; nunca
          // retrocede un estado ya más avanzado (lista/enviada/aceptada/...).
          ...(data.markReady && existing.status === 'borrador' ? { status: 'lista' as const } : {}),
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, data.id!)).returning();
        await tx.insert(quoteVersions).values({ quoteId: updated.id, version: updated.version, snapshot: updated, createdBy: session.userId });
      });
      revalidateClient(existing.clientId);
      return { ok: true, data: { id: data.id } };
    }

    const id = randomUUID();
    await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('pixeltec:quote-folio', 0))`);
    const folios = await tx.select({ folio: quotes.folio }).from(quotes);
    const [created] = await tx.insert(quotes).values({
      id,
      clientId: clientPgId,
      folio: nextFolio(new Date().getFullYear(), folios.map((f) => f.folio)),
      title: data.title.trim(),
      items,
      taxEnabled: data.taxEnabled,
      notes: data.notes.trim(),
      // §6: si no la tocó, hoy + 15 días. Nunca se guarda sin vigencia.
      validUntil: validUntil ?? defaultValidUntil(new Date()),
      currency: data.currency,
      problem: data.problem.trim(),
      solution: data.solution.trim(),
      scopeIncluded: data.scopeIncluded.trim(),
      exclusions: data.exclusions.trim() || DEFAULT_EXCLUSIONS,
      estimatedDelivery: data.estimatedDelivery.trim(),
      paymentTerms: data.paymentTerms,
      status: data.markReady ? 'lista' : 'borrador',
      publicToken: randomBytes(24).toString('base64url'),
      createdBy: session.userId,
    }).returning();
    await tx.insert(quoteVersions).values({ quoteId: id, version: 1, snapshot: created, createdBy: session.userId });
    });
    revalidateClient(data.clientId);
    return { ok: true, data: { id } };
  } catch (err) {
    return fail(err, 'save_quote_failed', 'No se pudo guardar la cotización.');
  }
}

/** Borra una cotización. */
export async function deleteQuote(id: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Borrar una cotización requiere rol administrador.' };

    const existing = await getOwnedQuoteById(id, guard.uid);
    if (!existing) return { ok: true };

    await db.delete(quotes).where(and(eq(quotes.id, id),eq(quotes.version,existing.version),sql`${quotes.status} not in ('aceptada','aceptacion_pendiente','rechazada')`));
    revalidateClient(existing.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'delete_quote_failed', 'No se pudo borrar la cotización.');
  }
}

/**
 * Envía la cotización por correo con el PDF adjunto.
 *
 * Acción explícita de un administrador — nunca se dispara sola. `to` permite
 * corregir el destinatario cuando el correo del cliente está desactualizado.
 */
export async function sendQuoteByEmail(id: string, to?: string): Promise<ActionResult<{ to: string }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Enviar una cotización requiere rol administrador.' };

    const quote = await getOwnedQuoteById(id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };

    const client = await getQuoteClient(quote.clientId);
    if (!client) return { ok: false, error: 'El cliente ya no existe.' };

    const recipient = z.string().email().max(254).parse((to ?? client.email ?? '').trim());
    if (!recipient) return { ok: false, error: 'Este cliente no tiene correo. Escribe uno para enviar.' };

    const blocking = missingToSend(quote);
    if (blocking.length > 0) {
      return { ok: false, error: `Antes de enviarla falta ${blocking.join(', ')}.` };
    }

    if (['aceptada','aceptacion_pendiente','rechazada'].includes(quote.status)) return {ok:false,error:'Esta cotización ya tiene una decisión. Conserva su evidencia.'};

    // El importe que se comunica es el de la inversión inicial: sumarle una
    // mensualidad daría un número que no significa nada.
    const totals = computeBreakdown(quote.items, quote.taxEnabled).oneTime;
    const url = `${SITE.url}/c/${quote.publicToken}`;

    const pdf = await renderQuotePdf({ quote, clientName: client.name });
    const html = renderQuoteEmailHtml({
      clientName: client.name,
      folio: quote.folio,
      title: quote.title,
      total: formatAmountWithCode(totals.totalCents, quote.currency),
      url,
      validUntil: formatDate(quote.validUntil),
    });

    const commandId = eventKey('quote-email:' + guard.uid + ':' + quote.id + ':' + quote.version + ':' + recipient.toLowerCase());
    const providerKey = 'quote/' + commandId + '/' + randomUUID();
    const claimed = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${commandId},0))`);
      const [prior] = await tx.select().from(commercialCommands).where(eq(commercialCommands.id, commandId));
      if (prior?.status === 'done') return 'done';
      if (prior && !(prior.result as { retryable?: boolean } | null)?.retryable) return 'uncertain';
      await tx.insert(commercialCommands).values({ id: commandId, ownerId: guard.uid, resourceId: quote.id, action: 'quote_email', payloadHash: commandId, status: 'processing', result: { providerKey } }).onConflictDoUpdate({ target: commercialCommands.id, set: { status: 'processing', result: { providerKey }, updatedAt: new Date() } });
      return 'claimed';
    });
    if (claimed === 'done') return { ok: true, data: { to: recipient } };
    if (claimed === 'uncertain') return { ok: false, error: 'Este envío está pendiente de conciliación. Comprueba su recibo antes de repetirlo.' };
    const result = await sendEmail(recipient, buildEmailSubject(quote), html, [
      { filename: `${quote.folio}.pdf`, content: pdf },
    ], { idempotencyKey: providerKey });
    await db.update(commercialCommands).set({ status: result.success ? 'done' : 'unknown', result: { providerKey, providerId: result.id || null, retryable: !result.success && result.error !== 'email_unknown_failure', error: result.error || null }, updatedAt: new Date() }).where(eq(commercialCommands.id, commandId));
    if (!result.success) return { ok: false, error: result.error === 'email_unknown_failure' ? 'El proveedor no confirmó el envío. Comprueba su recibo antes de repetirlo.' : 'El correo no salió. Revisa el destinatario o la conexión y vuelve a intentar.' };

    const sentAt = new Date();
    await db
      .update(quotes)
      .set({
        status: 'enviada',
        sentAt,
        // §20: el seguimiento se agenda solo al enviar. Sin jobs ni cron.
        nextFollowUpAt: firstFollowUp(sentAt),
        updatedAt: sentAt,
      })
      .where(and(eq(quotes.id, id),eq(quotes.version,quote.version),sql`${quotes.status} not in ('aceptada','aceptacion_pendiente','rechazada')`));
    revalidateClient(quote.clientId);

    return { ok: true, data: { to: recipient } };
  } catch (err) {
    return fail(err, 'send_quote_failed', 'No se pudo enviar la cotización.');
  }
}

/**
 * Marca la cotización como enviada tras compartirla por WhatsApp.
 *
 * El envío por WhatsApp lo hace Miguel desde su propio WhatsApp (enlace
 * `wa.me`): aquí solo se registra que salió, para que el estado no mienta.
 */
export async function markQuoteShared(id: string): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const quote = await getOwnedQuoteById(id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (['aceptada', 'aceptacion_pendiente'].includes(quote.status)) return { ok: false, error: 'Esta versión tiene una aceptación. Conserva su evidencia y confirma la venta.' };

    const blocking = missingToSend(quote);
    if (blocking.length > 0) {
      return { ok: false, error: `Antes de marcarla enviada falta ${blocking.join(', ')}.` };
    }

    const sentAt = quote.sentAt ? new Date(quote.sentAt) : new Date();
    await db
      .update(quotes)
      .set({ status: 'enviada', sentAt, nextFollowUpAt: firstFollowUp(sentAt), updatedAt: new Date() })
      .where(and(eq(quotes.id, id),eq(quotes.version,quote.version),sql`${quotes.status} not in ('aceptada','aceptacion_pendiente','rechazada')`));
    revalidateClient(quote.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'mark_shared_failed', 'No se pudo actualizar el estado.');
  }
}

/** Lista para la pestaña del cliente (el workspace es un Client Component). */
export async function listQuotesAction(clientId: string): Promise<ActionResult<{ quotes: unknown[] }>> {
  try {
    const session = await requireCommercialAccess();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };
    const { listQuotesForClient } = await import('./queries');
    // Igual que al guardar: llega el id público, la tabla usa el uuid.
    const clientPgId = await resolveOwnedClientPgId(clientId, session.userId);
    if (!clientPgId) return { ok: true, data: { quotes: [] } };
    return { ok: true, data: { quotes: await listQuotesForClient(clientPgId) } };
  } catch (err) {
    return fail(err, 'list_quotes_failed', 'No se pudieron cargar las cotizaciones.');
  }
}

// ── Flujo comercial (WO-2026-00104 §21–§23) ─────────────────────────────────

const AcceptSchema = z.object({
  id: z.string().uuid(),
  acceptedVia: z.enum(ACCEPTED_VIA),
  /** `YYYY-MM-DD`. Por defecto hoy, pero se puede corregir. */
  acceptedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido.'),
  note: z.string().max(2000),
});

/**
 * Aceptar la cotización (WO-2026-00106 §1 y §3).
 *
 * La aceptación es explícita: no se acepta por abrir un enlace ni por descargar
 * el PDF. Y crea la Venta en la MISMA operación — el usuario no vuelve a
 * capturar cliente, conceptos ni total en Finanzas.
 *
 * Es idempotente por construcción: la garantía de «una cotización, una venta»
 * vive en el índice único de la base, no aquí.
 */
export async function acceptQuote(
  input: z.infer<typeof AcceptSchema>,
): Promise<ActionResult<{ saleId: string; folio: string; alreadyExisted: boolean }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const data = AcceptSchema.parse(input);
    const quote = await getOwnedQuoteById(data.id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    // «Lista» (borrador sin nada pendiente) se acepta igual que «Enviada»:
    // el mismo comentario de displayStatus() lo dice — una cotización
    // entregada impresa o en persona no depende de por dónde salió. Solo se
    // bloquea si de verdad le falta algo para poder enviarse.
    if (quote.status === 'borrador') {
      const blocking = missingToSend(quote);
      if (blocking.length > 0) {
        return { ok: false, error: `Antes de aceptarla falta ${blocking.join(', ')}.` };
      }
    }

    const acceptedAt = new Date(`${data.acceptedAt}T12:00:00`);
    if (Number.isNaN(acceptedAt.getTime())) {
      return { ok: false, error: 'La fecha de aceptación no es válida.' };
    }

    const sale = await acceptQuoteAndCreateSale({
      quoteId: quote.id,
      expectedVersion: quote.version,
      clientId: quote.clientId,
      title: quote.title,
      folio: quote.folio,
      items: quote.items,
      taxEnabled: quote.taxEnabled,
      currency: quote.currency,
      paymentTerms: quote.paymentTerms,
      validUntil: quote.validUntil,
      acceptedAt,
      acceptedVia: data.acceptedVia,
      acceptanceNote: data.note.trim(),
      actorId: guard.uid,
    });

    const won=await db.update(commercialOpportunities).set({stage:'ganado',revision:sql`${commercialOpportunities.revision}+1`,updatedAt:new Date()}).where(and(eq(commercialOpportunities.ownerId,guard.uid),eq(commercialOpportunities.quoteId,quote.id),sql`${commercialOpportunities.stage}<>'ganado'`)).returning({id:commercialOpportunities.id});
    if(won.length) await db.insert(clientActivity).values({ownerId:guard.uid,clientId:quote.clientId,type:'commercial_sale_confirmed',actorName:guard.uid,message:'Venta confirmada desde la cotización '+quote.folio,metadata:{saleId:sale.saleId,version:quote.version}});

    revalidateClient(quote.clientId);
    revalidatePath('/cobros');
    return { ok: true, data: sale };
  } catch (err) {
    return fail(err, 'accept_quote_failed', 'No se pudo marcar como aceptada.');
  }
}

const RejectSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(REJECTION_REASONS),
  comment: z.string().max(2000),
});

/** Marca la cotización como rechazada y guarda el motivo (§23). */
export async function rejectQuote(input: z.infer<typeof RejectSchema>): Promise<ActionResult> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const data = RejectSchema.parse(input);
    const quote = await getOwnedQuoteById(data.id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (['aceptada', 'aceptacion_pendiente'].includes(quote.status)) return { ok: false, error: 'Esta versión tiene una aceptación. Conserva su evidencia y confirma la venta.' };

    await db
      .update(quotes)
      .set({
        status: 'rechazada',
        rejectedAt: new Date(),
        rejection: { reason: data.reason, comment: data.comment.trim() },
        nextFollowUpAt: null,
        updatedAt: new Date(),
      })
      .where(and(eq(quotes.id, data.id),eq(quotes.version,quote.version),sql`${quotes.status} not in ('aceptada','aceptacion_pendiente')`));
    revalidateClient(quote.clientId);
    return { ok: true };
  } catch (err) {
    return fail(err, 'reject_quote_failed', 'No se pudo marcar como rechazada.');
  }
}

/** Aplaza el seguimiento siete días (§20). No hay recordatorios automáticos. */
export async function snoozeFollowUp(id: string): Promise<ActionResult<{ nextFollowUpAt: string }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Requiere rol administrador.' };

    const quote = await getOwnedQuoteById(id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (['aceptada', 'aceptacion_pendiente'].includes(quote.status)) return { ok: false, error: 'Esta versión tiene una aceptación. Conserva su evidencia y confirma la venta.' };

    const next = nextFollowUp(new Date());
    await db.update(quotes).set({ nextFollowUpAt: next, updatedAt: new Date() }).where(and(eq(quotes.id, id),eq(quotes.version,quote.version),sql`${quotes.status} not in ('aceptada','aceptacion_pendiente','rechazada')`));
    revalidateClient(quote.clientId);
    return { ok: true, data: { nextFollowUpAt: next.toISOString() } };
  } catch (err) {
    return fail(err, 'snooze_failed', 'No se pudo reprogramar el seguimiento.');
  }
}

/**
 * Crea el cobro de la primera parcialidad (§22).
 *
 * Inserta en `billing_items` desde `billing-bridge.ts`, un archivo nuevo:
 * Finanzas no se modifica. No crea proyectos, tareas ni contratos.
 */
export async function createChargeForQuote(
  id: string,
): Promise<ActionResult<{ concept: string; amount: string; recurrentes: string[] }>> {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return { ok: false, error: 'Crear un cobro requiere rol administrador.' };

    const quote = await getOwnedQuoteById(id, guard.uid);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    if (quote.status !== 'aceptada') {
      return { ok: false, error: 'Solo se crea el cobro de una cotización aceptada.' };
    }

    const breakdown = computeBreakdown(quote.items, quote.taxEnabled);
    const totals = breakdown.oneTime;
    const instalment = firstInstalment(totals.totalCents, quote.paymentTerms);
    if (!instalment || instalment.amountCents <= 0) {
      return { ok: false, error: 'La cotización no tiene un importe que cobrar.' };
    }

    const concept = `${instalment.label} ${quote.folio}`;
    // `billing_items.due_date` es NOT NULL: se usa la vigencia y, si no la hay, hoy.
    const dueDate = (quote.validUntil ?? new Date().toISOString()).slice(0, 10);

    const created = await createChargeFromQuote({
      clientId: quote.clientId,
      concept,
      amountCents: instalment.amountCents,
      currency: quote.currency,
      dueDate,
      frequency: 'unico',
    });
    if (!created) return { ok: false, error: 'No se pudo crear el cobro.' };

    // Los conceptos recurrentes se dan de alta como cobros recurrentes de
    // verdad: `billing_items.frequency` ya admite mensual, trimestral y anual,
    // así que no hace falta inventar nada. Sin esto, un concepto mensual
    // quedaría cotizado y jamás cobrado.
    const recurrentes: string[] = [];
    for (const grupo of breakdown.recurring) {
      if (grupo.totals.totalCents <= 0) continue;
      const etiqueta = RECURRENCE_TOTAL_LABEL[grupo.recurrence];
      const ok = await createChargeFromQuote({
        clientId: quote.clientId,
        concept: `${etiqueta} ${quote.folio}`,
        amountCents: grupo.totals.totalCents,
        currency: quote.currency,
        dueDate,
        frequency: toBillingFrequency(grupo.recurrence),
      });
      if (ok) recurrentes.push(`${etiqueta}: ${formatAmountWithCode(grupo.totals.totalCents, quote.currency)}`);
    }

    // La anualidad ya no viaja dentro de `breakdown.recurring` (desde
    // 2026-08-27 su primer año va en el total inicial), así que sin este bloque
    // un concepto anual quedaría cotizado y JAMÁS cobrado por este camino.
    // Vence en el primer aniversario de la aceptación, no en la vigencia de la
    // cotización: es el año 2 lo que se está dando de alta.
    if (breakdown.annualRenewal && breakdown.annualRenewal.totalCents > 0) {
      const aceptada = quote.acceptedAt ? new Date(quote.acceptedAt) : new Date();
      const ok = await createChargeFromQuote({
        clientId: quote.clientId,
        concept: `Renovación anual ${quote.folio}`,
        amountCents: breakdown.annualRenewal.totalCents,
        currency: quote.currency,
        dueDate: firstAnniversary(Number.isNaN(aceptada.getTime()) ? new Date() : aceptada),
        frequency: 'anual',
      });
      if (ok) {
        recurrentes.push(
          `Renovación anual: ${formatAmountWithCode(breakdown.annualRenewal.totalCents, quote.currency)}`,
        );
      }
    }

    revalidateClient(quote.clientId);
    revalidatePath('/cobros');
    return {
      ok: true,
      data: {
        concept,
        amount: formatAmountWithCode(instalment.amountCents, quote.currency),
        recurrentes,
      },
    };
  } catch (err) {
    return fail(err, 'create_charge_failed', 'No se pudo crear el cobro.');
  }
}

/** Una cotización suelta, para la vista de detalle (§16). */
export async function getQuoteAction(id: string): Promise<ActionResult<{ quote: unknown }>> {
  try {
    const session = await requireCommercialAccess();
    if (!session) return { ok: false, error: 'Necesitas iniciar sesión.' };
    const quote = await getOwnedQuoteById(id, session.userId);
    if (!quote) return { ok: false, error: 'La cotización ya no existe.' };
    return { ok: true, data: { quote } };
  } catch (err) {
    return fail(err, 'get_quote_failed', 'No se pudo cargar la cotización.');
  }
}
