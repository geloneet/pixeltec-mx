import type { HoyViewId } from "@/components/hoy/hoy-views";
import type { PriorityRow, PriorityStatus, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot, SnapClient, SnapConversation, SnapQuote } from "@/lib/hoy/snapshot";
import { diffDayKeys, toDayKey, zonedDayKey } from "./date-windows";
import {
  UNPAID_BILLING,
  clientHref,
  followUpState,
  formatCents,
  formatPesosWithCode,
  indexClients,
  isoTime,
  need,
  rows,
} from "./common";

/**
 * Prioridades de hoy (WO-2026-00515 §3). Orden:
 *   0 cobro vencido · 1 seguimiento vencido · 2 vence/toca hoy ·
 *   3 cotización enviada sin respuesta · 4 cobro que vence en ≤ 7 días.
 * Una fila por cliente con su motivo más urgente.
 */
type Kind = "pago" | "cotizacion" | "accion";

interface Candidate {
  clientPgId: string;
  rank: number;
  kind: Kind;
  status: PriorityStatus;
  amountText: string | null;
  nextAction: { label: string; dueAt: string | null } | null;
  sortAt: number;
  quote?: SnapQuote;
}

const MAX_ROWS = 5;

function buildCandidates(snap: HoySnapshot): Candidate[] {
  const now = snap.now;
  const today = zonedDayKey(now);
  const out: Candidate[] = [];

  for (const b of rows(snap.billing)) {
    if (!UNPAID_BILLING.has(b.status)) continue;
    const diff = diffDayKeys(b.dueDate, today);
    if (diff > 7) continue;
    out.push({
      clientPgId: b.clientPgId,
      rank: diff < 0 ? 0 : diff === 0 ? 2 : 4,
      kind: "pago",
      status: diff < 0 ? "pago_vencido" : "pago_pendiente",
      amountText: formatPesosWithCode(b.amount, b.currency),
      nextAction: { label: diff < 0 ? "Cobrar pago vencido" : "Confirmar pago", dueAt: b.dueDate },
      sortAt: isoTime(b.dueDate),
    });
  }

  for (const q of rows(snap.quotes)) {
    const state = followUpState(q, now);
    if (state === null) continue;
    out.push({
      clientPgId: q.clientPgId,
      rank: state === "vencido" ? 1 : state === "hoy" ? 2 : 3,
      kind: "cotizacion",
      status: state === "futuro" ? "cotizacion_enviada" : "seguimiento",
      amountText: formatCents(q.totalCents, q.currency),
      nextAction: { label: "Dar seguimiento a la cotización", dueAt: q.nextFollowUpAt },
      sortAt: isoTime(q.nextFollowUpAt),
      quote: q,
    });
  }

  for (const c of rows(snap.clients)) {
    const key = toDayKey(c.nextAction?.dueAt ?? null);
    if (!c.nextAction || !key || key > today) continue;
    out.push({
      clientPgId: c.pgId,
      rank: key < today ? 1 : 2,
      kind: "accion",
      status: "seguimiento",
      amountText: null,
      nextAction: c.nextAction,
      sortAt: isoTime(c.nextAction.dueAt),
    });
  }
  return out;
}

function matchesView(c: Candidate, view: HoyViewId, client: SnapClient): boolean {
  switch (view) {
    case "pendientes":
      return c.rank <= 2;
    case "cotizaciones":
      return c.kind === "cotizacion";
    case "cobros":
      return c.kind === "pago";
    case "clientes-activos":
      return client.crmStatus === "activo";
    default:
      return true;
  }
}

function latestQuoteSent(quotes: SnapQuote[], clientPgId: string): SnapQuote | undefined {
  return quotes
    .filter((q) => q.clientPgId === clientPgId && q.sentAt && q.status === "enviada")
    .sort((a, b) => Date.parse(b.sentAt!) - Date.parse(a.sentAt!))[0];
}

function openQuoteAmount(quotes: SnapQuote[], clientPgId: string): string | null {
  const q = quotes
    .filter((x) => x.clientPgId === clientPgId && (x.status === "enviada" || x.status === "lista"))
    .sort((a, b) => isoTime(b.sentAt) - isoTime(a.sentAt))[0];
  return q ? formatCents(q.totalCents, q.currency) : null;
}

export function derivePriorities(
  snap: HoySnapshot,
  view: HoyViewId,
): WidgetResult<{ rows: PriorityRow[]; total: number }> {
  const check = need(snap, "clients", "quotes", "billing");
  if (!check.ok) return check;

  const clients = indexClients(rows(snap.clients));
  const quotes = rows(snap.quotes);
  const convByClient = new Map<string, SnapConversation>();
  for (const conv of snap.conversations.items) {
    if (conv.clientPgId && !convByClient.has(conv.clientPgId)) convByClient.set(conv.clientPgId, conv);
  }

  const best = new Map<string, Candidate>();
  for (const cand of buildCandidates(snap)) {
    const client = clients.get(cand.clientPgId);
    if (!client || !matchesView(cand, view, client)) continue;
    const prev = best.get(cand.clientPgId);
    if (!prev || cand.rank < prev.rank || (cand.rank === prev.rank && cand.sortAt < prev.sortAt)) {
      best.set(cand.clientPgId, cand);
    }
  }

  const ordered = [...best.values()].sort((a, b) => a.rank - b.rank || a.sortAt - b.sortAt);

  const priorityRows = ordered.slice(0, MAX_ROWS).map((cand): PriorityRow => {
    const client = clients.get(cand.clientPgId)!;
    const conv = convByClient.get(client.pgId);
    const sent = latestQuoteSent(quotes, client.pgId);
    let channel: PriorityRow["channel"] = null;
    let message: string | null = null;
    let messageAt: string | null = null;
    if (conv) {
      channel = "whatsapp";
      message = conv.preview;
      messageAt = conv.lastMessageAt;
    } else if (sent) {
      // `quotes` no guarda por dónde salió (correo o wa.me): sin canal
      // verificable no se pinta chip de canal; el mensaje es el hecho.
      message = `Se envió la cotización ${sent.folio} «${sent.title}».`;
      messageAt = sent.sentAt;
    }

    const cta =
      cand.kind === "pago"
        ? { label: "Registrar pago", href: "/cobros" }
        : conv
          ? { label: "Ver conversación", href: "/whatsapp" }
          : { label: "Dar seguimiento", href: clientHref(client, "cotizaciones") };

    return {
      id: `${client.pgId}:${cand.kind}`,
      clientId: client.publicId,
      clientName: client.name,
      logoUrl: client.logoUrl,
      color: client.color,
      clientCrmStatus: client.crmStatus,
      channel,
      message,
      messageAt,
      status: cand.status,
      amountText: cand.amountText ?? openQuoteAmount(quotes, client.pgId),
      nextAction: cand.nextAction,
      cta,
      rank: cand.rank,
    };
  });

  return { ok: true, data: { rows: priorityRows, total: ordered.length } };
}
