import type { AlertRow, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { diffDayKeys, toDayKey, zonedDayKey } from "./date-windows";
import { UNPAID_BILLING, clientHref, indexClients, need, rows } from "./common";

const MAX_ROWS = 3;
const NO_REPLY_DAYS = 3;
const OPEN_QUOTE_DAYS = 7;

const SEVERITY: Record<AlertRow["kind"], number> = {
  cobro_vencido: 0,
  sin_respuesta: 1,
  cotizacion_abierta: 2,
  lead_contacto: 3,
  notificacion: 4,
};

function days(n: number) {
  return `${n} ${n === 1 ? "día" : "días"}`;
}

/**
 * Alertas derivadas (sin entidad nueva). Reglas:
 *  - cobro vencido (billing sin pagar con vencimiento pasado)
 *  - cliente sin respuesta: cotización enviada hace 3–6 días, o conversación
 *    cuyo último mensaje fue NUESTRO hace > 3 días
 *  - cotización abierta: enviada hace ≥ 7 días sin aceptar/rechazar
 *  - lead pidió contacto (`wants_contact`) y sigue `new` — se etiqueta así,
 *    nunca como «el bot detectó intención»
 *  - notificaciones no leídas de tipo warning/alert/error
 */
export function deriveAlerts(snap: HoySnapshot): WidgetResult<{ rows: AlertRow[]; total: number }> {
  const check = need(snap, "clients", "quotes", "billing", "leads", "notifications");
  if (!check.ok) return check;
  const now = snap.now;
  const today = zonedDayKey(now);
  const clients = indexClients(rows(snap.clients));
  const out: AlertRow[] = [];

  for (const b of rows(snap.billing)) {
    if (!UNPAID_BILLING.has(b.status) || diffDayKeys(b.dueDate, today) >= 0) continue;
    const name = clients.get(b.clientPgId)?.name ?? "Un cliente";
    out.push({
      id: `cv:${b.id}`,
      kind: "cobro_vencido",
      title: "Cobro vencido",
      description: `${name} tiene «${b.concept}» vencido desde hace ${days(-diffDayKeys(b.dueDate, today))}.`,
      at: b.dueDate,
      tone: "red",
      href: "/cobros",
    });
  }

  const noReplyClients = new Set<string>();
  for (const q of rows(snap.quotes)) {
    if (q.status !== "enviada" || !q.sentAt) continue;
    const sentKey = toDayKey(q.sentAt)!;
    const age = diffDayKeys(today, sentKey);
    const client = clients.get(q.clientPgId);
    const name = client?.name ?? "Un cliente";
    if (age >= OPEN_QUOTE_DAYS) {
      out.push({
        id: `qa:${q.id}`,
        kind: "cotizacion_abierta",
        title: "Cotización abierta",
        description: `${name} tiene la cotización ${q.folio} abierta desde hace ${days(age)}.`,
        at: q.sentAt,
        tone: "amber",
        href: clientHref(client, "cotizaciones"),
      });
    } else if (age >= NO_REPLY_DAYS) {
      noReplyClients.add(q.clientPgId);
      out.push({
        id: `sr:${q.id}`,
        kind: "sin_respuesta",
        title: "Cliente sin respuesta",
        description: `${name} lleva ${days(age)} sin responder a la cotización ${q.folio}.`,
        at: q.sentAt,
        tone: "red",
        href: clientHref(client, "cotizaciones"),
      });
    }
  }

  for (const conv of snap.conversations.items) {
    if (conv.direction !== "outbound" || !conv.lastMessageAt || !conv.clientPgId) continue;
    if (noReplyClients.has(conv.clientPgId)) continue;
    const age = diffDayKeys(today, toDayKey(conv.lastMessageAt)!);
    if (age <= NO_REPLY_DAYS) continue;
    const name = clients.get(conv.clientPgId)?.name ?? "Un contacto";
    out.push({
      id: `sw:${conv.phone}`,
      kind: "sin_respuesta",
      title: "Cliente sin respuesta",
      description: `${name} lleva ${days(age)} sin responder por WhatsApp.`,
      at: conv.lastMessageAt,
      tone: "red",
      href: "/whatsapp",
    });
  }

  for (const l of rows(snap.leads)) {
    if (!l.wantsContact || l.status !== "new") continue;
    out.push({
      id: `lc:${l.id}`,
      kind: "lead_contacto",
      title: "Lead pidió contacto",
      description: `${l.name} pidió que lo contacten desde el diagnóstico.`,
      at: l.wantsContactAt ?? l.createdAt,
      tone: "emerald",
      href: "/clientes/leads",
    });
  }

  for (const n of rows(snap.notifications)) {
    if (!["warning", "alert", "error"].includes(n.type)) continue;
    out.push({
      id: `n:${n.id}`,
      kind: "notificacion",
      title: n.title,
      description: n.body,
      at: n.createdAt,
      tone: n.type === "warning" ? "amber" : "red",
      href: n.href ?? "/notificaciones",
    });
  }

  out.sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind]);
  return { ok: true, data: { rows: out.slice(0, MAX_ROWS), total: out.length } };
}
