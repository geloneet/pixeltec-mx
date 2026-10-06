import type { ChecklistItem, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { toDayKey, zonedDayKey } from "./date-windows";
import { clientHref, followUpState, indexClients, isoTime, need, rows } from "./common";

/**
 * «Hoy debes hacer esto» — derivado y de SOLO LECTURA (D-5, sin tabla nueva).
 * Un ítem se marca hecho solo con evidencia del día:
 *  - seguimiento / próxima acción → `client_activity.type='seguimiento'` hoy
 *  - cobro que vence hoy → `payment_records` de ese cobro con fecha de hoy
 *  - lead nuevo de hoy → ya no está en estado `new`
 */
export function deriveChecklist(snap: HoySnapshot): WidgetResult<ChecklistItem[]> {
  const check = need(snap, "clients", "quotes", "billing", "payments", "leads", "activity");
  if (!check.ok) return check;

  const now = snap.now;
  const today = zonedDayKey(now);
  const clients = indexClients(rows(snap.clients));
  const followedToday = new Set(
    rows(snap.activity)
      .filter((a) => a.type === "seguimiento" && toDayKey(a.createdAt) === today)
      .map((a) => a.clientPgId),
  );
  const paidToday = new Set(rows(snap.payments).filter((p) => p.paidAt === today).map((p) => p.billingItemId));

  const items: ChecklistItem[] = [];

  for (const q of rows(snap.quotes)) {
    const state = followUpState(q, now);
    if (state !== "vencido" && state !== "hoy") continue;
    const client = clients.get(q.clientPgId);
    if (!client) continue;
    items.push({
      id: `q:${q.id}`,
      label: `Dar seguimiento a ${client.name}`,
      at: q.nextFollowUpAt,
      done: followedToday.has(q.clientPgId),
      href: clientHref(client, "cotizaciones"),
    });
  }

  for (const c of clients.values()) {
    if (!c.nextAction || toDayKey(c.nextAction.dueAt) !== today) continue;
    items.push({
      id: `na:${c.pgId}`,
      label: `${c.nextAction.label} — ${c.name}`,
      at: c.nextAction.dueAt,
      done: followedToday.has(c.pgId),
      href: clientHref(c),
    });
  }

  for (const b of rows(snap.billing)) {
    if (b.dueDate !== today || b.status === "cancelado") continue;
    const client = clients.get(b.clientPgId);
    items.push({
      id: `b:${b.id}`,
      label: `Confirmar pago con ${client?.name ?? b.concept}`,
      at: null,
      done: b.status === "pagado" || paidToday.has(b.id),
      href: "/cobros",
    });
  }

  for (const l of rows(snap.leads)) {
    if (toDayKey(l.createdAt) !== today) continue;
    items.push({
      id: `l:${l.id}`,
      label: `Contactar lead ${l.name}`,
      at: null,
      done: l.status !== "new",
      href: "/clientes/leads",
    });
  }

  // Con hora primero (ascendente); «Todo el día» al final, en orden de inserción.
  const timed = items.filter((i) => i.at && !/^\d{4}-\d{2}-\d{2}$/.test(i.at));
  const allDay = items.filter((i) => !timed.includes(i)).map((i) => ({ ...i, at: null }));
  timed.sort((a, b) => isoTime(a.at) - isoTime(b.at));
  return { ok: true, data: [...timed, ...allDay] };
}
