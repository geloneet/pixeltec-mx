import type { PipelineCard, PipelineColumn, PipelineStageId, Tone, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { diffDayKeys, toDayKey, zonedDayKey } from "./date-windows";
import { UNPAID_BILLING, clientHref, followUpState, formatPesosWithCode, formatRealCents, indexClients, need, rows } from "./common";

/**
 * Pipeline comercial DERIVADO (D-4, sin migración ni columna de etapa):
 *  - Nuevo lead          leads.status = 'new'
 *  - Contactado          leads.status ∈ (contacted, qualified) sin client_id
 *  - En seguimiento      clients.crm_status = 'prospecto' sin cotización enviada/aceptada ni venta
 *  - Cotización enviada  quote enviada sin seguimiento vencido/de hoy
 *  - Negociación         quote enviada con seguimiento hoy o vencido
 *  - Pago pendiente      sales 'pendiente_anticipo' ∪ billing pendiente/parcial/vencido
 *  - Cerrado             sales activa/completada aceptadas en los últimos 30 días
 */
export const PIPELINE_STAGES: { id: PipelineStageId; label: string; tone: Tone }[] = [
  { id: "nuevo_lead", label: "Nuevo lead", tone: "slate" },
  { id: "contactado", label: "Contactado", tone: "blue" },
  { id: "en_seguimiento", label: "En seguimiento", tone: "violet" },
  { id: "cotizacion_enviada", label: "Cotización enviada", tone: "blue" },
  { id: "negociacion", label: "Negociación", tone: "amber" },
  { id: "pago_pendiente", label: "Pago pendiente", tone: "orange" },
  { id: "cerrado", label: "Cerrado", tone: "emerald" },
];

const MAX_CARDS = 3;
const CLOSED_WINDOW_DAYS = 30;

export function derivePipeline(
  snap: HoySnapshot,
): WidgetResult<{ columns: PipelineColumn[]; total: number }> {
  const check = need(snap, "clients", "quotes", "sales", "billing", "leads");
  if (!check.ok) return check;
  const now = snap.now;
  const today = zonedDayKey(now);
  const clients = indexClients(rows(snap.clients));
  const quotes = rows(snap.quotes);
  const sales = rows(snap.sales);
  const buckets: Record<PipelineStageId, PipelineCard[]> = {
    nuevo_lead: [],
    contactado: [],
    en_seguimiento: [],
    cotizacion_enviada: [],
    negociacion: [],
    pago_pendiente: [],
    cerrado: [],
  };
  const name = (pgId: string) => clients.get(pgId)?.name ?? "Cliente";

  for (const l of rows(snap.leads)) {
    const card = { id: `l:${l.id}`, name: l.name, amountText: null, href: "/clientes/leads" };
    if (l.status === "new") buckets.nuevo_lead.push(card);
    else if ((l.status === "contacted" || l.status === "qualified") && !l.clientPgId) buckets.contactado.push(card);
  }

  const engaged = new Set<string>([
    ...quotes.filter((q) => q.status === "enviada" || q.status === "aceptada" || q.status === "vencida").map((q) => q.clientPgId),
    ...sales.map((s) => s.clientPgId),
  ]);
  for (const c of clients.values()) {
    if (c.crmStatus !== "prospecto" || engaged.has(c.pgId)) continue;
    buckets.en_seguimiento.push({ id: `c:${c.pgId}`, name: c.name, amountText: null, href: clientHref(c) });
  }

  for (const q of quotes) {
    const state = followUpState(q, now);
    if (q.status !== "enviada") continue;
    const card = {
      id: `q:${q.id}`,
      name: name(q.clientPgId),
      amountText: formatRealCents(q.totalCents, q.currency),
      href: clientHref(clients.get(q.clientPgId), "cotizaciones"),
    };
    if (state === "vencido" || state === "hoy") buckets.negociacion.push(card);
    else buckets.cotizacion_enviada.push(card);
  }

  for (const s of sales) {
    if (s.status === "pendiente_anticipo") {
      buckets.pago_pendiente.push({ id: `s:${s.id}`, name: name(s.clientPgId), amountText: formatRealCents(s.totalCents, s.currency), href: "/cobros" });
    } else if (s.status === "activa" || s.status === "completada") {
      const key = toDayKey(s.acceptedAt);
      if (key && diffDayKeys(today, key) <= CLOSED_WINDOW_DAYS) {
        buckets.cerrado.push({ id: `s:${s.id}`, name: name(s.clientPgId), amountText: formatRealCents(s.totalCents, s.currency), href: clientHref(clients.get(s.clientPgId)) });
      }
    }
  }

  for (const b of rows(snap.billing)) {
    if (!UNPAID_BILLING.has(b.status)) continue;
    buckets.pago_pendiente.push({ id: `b:${b.id}`, name: name(b.clientPgId), amountText: Number.isFinite(b.amount) && b.amount > 0 ? formatPesosWithCode(b.amount, b.currency) : null, href: "/cobros" });
  }

  const columns = PIPELINE_STAGES.map((stage): PipelineColumn => {
    const cards = buckets[stage.id];
    return { ...stage, count: cards.length, cards: cards.slice(0, MAX_CARDS), more: Math.max(0, cards.length - MAX_CARDS) };
  });
  return { ok: true, data: { columns, total: columns.reduce((s, c) => s + c.count, 0) } };
}
