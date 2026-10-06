import type { ActivityFilter, ActivityKind, ActivityRow, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { clientHref, formatPesosWithCode, indexClients, need, rows } from "./common";

const MAX_ROWS = 12;

const FILTER_KINDS: Record<ActivityFilter, ActivityKind[] | null> = {
  todas: null,
  whatsapp: ["whatsapp"],
  correo: ["correo"],
  cotizaciones: ["cotizacion"],
  cobros: ["cobro"],
};

export const ACTIVITY_FILTERS: { id: ActivityFilter; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "correo", label: "Correo" },
  { id: "cotizaciones", label: "Cotizaciones" },
  { id: "cobros", label: "Cobros" },
];

export function parseActivityFilter(raw: string | string[] | undefined | null): ActivityFilter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return ACTIVITY_FILTERS.some((f) => f.id === v) ? (v as ActivityFilter) : "todas";
}

/** Tipos de `client_activity` que son envíos por correo (propuestas). */
const EMAIL_ACTIVITY = new Set(["propuesta_enviada"]);
const QUOTE_ACTIVITY = new Set(["cotizacion_enviada", "cotizacion_aceptada", "cotizacion_rechazada"]);

/**
 * Actividad reciente: UNION derivado de client_activity, cotizaciones
 * (enviada/aceptada/rechazada), pagos, leads y conversaciones entrantes.
 * Los eventos de cotización ya registrados en `client_activity` (A7b) no se
 * duplican con los de la tabla `quotes`.
 */
export function deriveActivity(snap: HoySnapshot, filter: ActivityFilter): WidgetResult<ActivityRow[]> {
  const check = need(snap, "clients", "quotes", "payments", "leads", "activity");
  if (!check.ok) return check;
  const clients = indexClients(rows(snap.clients));
  const name = (pgId: string) => clients.get(pgId)?.name ?? "un cliente";
  const out: ActivityRow[] = [];

  const loggedQuoteEvents = new Set<string>();
  for (const a of rows(snap.activity)) {
    const kind: ActivityKind = EMAIL_ACTIVITY.has(a.type) ? "correo" : QUOTE_ACTIVITY.has(a.type) ? "cotizacion" : "cliente";
    if (QUOTE_ACTIVITY.has(a.type)) loggedQuoteEvents.add(`${a.clientPgId}:${a.type}:${a.createdAt.slice(0, 16)}`);
    out.push({ id: `a:${a.id}`, kind, title: a.message, subtitle: name(a.clientPgId), at: a.createdAt, href: clientHref(clients.get(a.clientPgId)) });
  }

  for (const q of rows(snap.quotes)) {
    const href = clientHref(clients.get(q.clientPgId), "cotizaciones");
    const events: [string | null, string, string][] = [
      [q.sentAt, "cotizacion_enviada", `Cotización enviada a ${name(q.clientPgId)}`],
      [q.acceptedAt, "cotizacion_aceptada", `Cotización aceptada por ${name(q.clientPgId)}`],
      [q.rejectedAt, "cotizacion_rechazada", `Cotización rechazada por ${name(q.clientPgId)}`],
    ];
    for (const [at, type, title] of events) {
      if (!at || loggedQuoteEvents.has(`${q.clientPgId}:${type}:${at.slice(0, 16)}`)) continue;
      out.push({ id: `q:${q.id}:${type}`, kind: "cotizacion", title, subtitle: `${q.folio} · ${q.title}`, at, href });
    }
  }

  for (const p of rows(snap.payments)) {
    out.push({
      id: `p:${p.id}`,
      kind: "cobro",
      title: `Pago recibido de ${name(p.clientPgId)}`,
      subtitle: formatPesosWithCode(p.amount, p.currency),
      at: p.createdAt,
      href: "/cobros",
    });
  }

  for (const l of rows(snap.leads)) {
    out.push({ id: `l:${l.id}`, kind: "lead", title: `Nuevo lead: ${l.name}`, subtitle: null, at: l.createdAt, href: "/clientes/leads" });
  }

  for (const c of snap.conversations.items) {
    if (c.direction !== "inbound" || !c.lastMessageAt) continue;
    const who = c.clientPgId ? name(c.clientPgId) : "un contacto";
    out.push({ id: `w:${c.phone}`, kind: "whatsapp", title: `Nuevo mensaje de ${who}`, subtitle: c.preview, at: c.lastMessageAt, href: "/whatsapp" });
  }

  const kinds = FILTER_KINDS[filter];
  const data = out
    .filter((r) => !kinds || kinds.includes(r.kind))
    .filter((r) => !Number.isNaN(Date.parse(r.at)))
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, MAX_ROWS);
  return { ok: true, data };
}
