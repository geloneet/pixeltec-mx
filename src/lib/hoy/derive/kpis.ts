import type { KpiCard, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { addDaysToKey, diffDayKeys, lastNDayKeys, toDayKey, zonedDayKey } from "./date-windows";
import { buildDelta } from "./percent-delta";
import { followUpState, formatPesos } from "./common";

const SERIES_DAYS = 7;

function countByDay(keys: (string | null)[], days: string[]): number[] {
  return days.map((d) => keys.filter((k) => k === d).length);
}

function sumByDay(entries: { key: string | null; amount: number }[], days: string[]): number[] {
  return days.map((d) => entries.filter((e) => e.key === d).reduce((s, e) => s + e.amount, 0));
}

function describeSeries(days: string[], values: (number | string)[], unit: string): string {
  return `Últimos ${days.length} días (${unit}): ${values.join(", ")}`;
}

function unavailable(card: Omit<KpiCard, "valueText" | "delta" | "series" | "seriesLabel">): KpiCard {
  return { ...card, valueText: null, delta: null, series: [], seriesLabel: "Serie no disponible" };
}

/**
 * Los cinco KPI del mockup. Cada uno depende solo de su fuente: si falla la
 * consulta de pagos, «Cobrado este mes» queda sin dato y el resto sigue.
 */
export function deriveKpis(snap: HoySnapshot): WidgetResult<KpiCard[]> {
  const now = snap.now;
  const today = zonedDayKey(now);
  const yesterday = addDaysToKey(today, -1);
  const days = lastNDayKeys(today, SERIES_DAYS);
  const cards: KpiCard[] = [];

  // 1 · Leads nuevos (feed global de `leads`, igual que /clientes/leads)
  const leadsBase = { id: "leads", label: "Leads nuevos", chart: "line", tone: "blue", href: "/clientes/leads" } as const;
  if (snap.leads.ok) {
    const keys = snap.leads.data.map((l) => toDayKey(l.createdAt));
    const series = countByDay(keys, days);
    const current = series[SERIES_DAYS - 1];
    cards.push({
      ...leadsBase,
      valueText: String(current),
      delta: buildDelta(current, series[SERIES_DAYS - 2], "vs. ayer", "up-good"),
      series,
      seriesLabel: describeSeries(days, series, "leads por día"),
    });
  } else cards.push(unavailable(leadsBase));

  // 2 · Seguimientos hoy (cotizaciones con seguimiento hoy/vencido + próximas acciones)
  const segBase = { id: "seguimientos", label: "Seguimientos hoy", chart: "line", tone: "blue", href: "/cotizaciones" } as const;
  if (snap.quotes.ok && snap.clients.ok) {
    const quoteDue = snap.quotes.data.filter((q) => {
      const s = followUpState(q, now);
      return s === "vencido" || s === "hoy";
    }).length;
    const actionKeys = snap.clients.data.map((c) => toDayKey(c.nextAction?.dueAt ?? null));
    const actionDue = actionKeys.filter((k) => k !== null && k <= today).length;
    const scheduled = [
      ...snap.quotes.data.filter((q) => q.status === "enviada").map((q) => toDayKey(q.nextFollowUpAt)),
      ...actionKeys,
    ];
    const series = countByDay(scheduled, days);
    cards.push({
      ...segBase,
      valueText: String(quoteDue + actionDue),
      delta: buildDelta(series[SERIES_DAYS - 1], series[SERIES_DAYS - 2], "programados vs. ayer", "up-good"),
      series,
      seriesLabel: describeSeries(days, series, "seguimientos programados por día"),
    });
  } else cards.push(unavailable(segBase));

  // 3 · Cotizaciones pendientes (displayStatus ∈ {enviada, lista})
  const cotBase = { id: "cotizaciones", label: "Cotizaciones pendientes", chart: "line", tone: "amber", href: "/cotizaciones" } as const;
  if (snap.quotes.ok) {
    const pending = snap.quotes.data.filter((q) => q.status === "enviada" || q.status === "lista").length;
    const series = countByDay(snap.quotes.data.map((q) => toDayKey(q.sentAt)), days);
    cards.push({
      ...cotBase,
      valueText: String(pending),
      delta: buildDelta(series[SERIES_DAYS - 1], series[SERIES_DAYS - 2], "enviadas vs. ayer", "up-good"),
      series,
      seriesLabel: describeSeries(days, series, "cotizaciones enviadas por día"),
    });
  } else cards.push(unavailable(cotBase));

  // 4 · Cobros por vencer (próximos 7 días) vs. los que vencían la semana pasada
  const cobBase = { id: "cobros", label: "Cobros por vencer", chart: "line", tone: "red", href: "/cobros" } as const;
  if (snap.billing.ok) {
    const items = snap.billing.data;
    const upcoming = items.filter(
      (b) => (b.status === "pendiente" || b.status === "parcial") && diffDayKeys(b.dueDate, today) >= 0 && diffDayKeys(b.dueDate, today) <= 7,
    ).length;
    const previous = items.filter((b) => {
      const d = diffDayKeys(b.dueDate, today);
      return b.status !== "cancelado" && d >= -7 && d <= -1;
    }).length;
    const nextDays = Array.from({ length: SERIES_DAYS }, (_, i) => addDaysToKey(today, i));
    const series = countByDay(
      items.filter((b) => b.status === "pendiente" || b.status === "parcial").map((b) => b.dueDate),
      nextDays,
    );
    cards.push({
      ...cobBase,
      valueText: String(upcoming),
      delta: buildDelta(upcoming, previous, "vs. semana pasada", "up-bad"),
      series,
      seriesLabel: `Próximos ${SERIES_DAYS} días (cobros que vencen por día): ${series.join(", ")}`,
    });
  } else cards.push(unavailable(cobBase));

  // 5 · Cobrado este mes (pagos del mes en CDMX) vs. mismo tramo del mes anterior
  const cdoBase = { id: "cobrado", label: "Cobrado este mes", chart: "bars", tone: "emerald", href: "/cobros" } as const;
  if (snap.payments.ok) {
    const monthStart = `${today.slice(0, 7)}-01`;
    const dayOfMonth = Number(today.slice(8, 10));
    const prevMonthStart = addDaysToKey(monthStart, -1).slice(0, 7) + "-01";
    const prevMonthCut = addDaysToKey(prevMonthStart, dayOfMonth - 1);
    const pays = snap.payments.data;
    const current = pays.filter((p) => p.paidAt >= monthStart && p.paidAt <= today).reduce((s, p) => s + p.amount, 0);
    const previous = pays
      .filter((p) => p.paidAt >= prevMonthStart && p.paidAt <= prevMonthCut && p.paidAt < monthStart)
      .reduce((s, p) => s + p.amount, 0);
    const series = sumByDay(pays.map((p) => ({ key: p.paidAt, amount: p.amount })), days);
    cards.push({
      ...cdoBase,
      valueText: formatPesos(current),
      delta: buildDelta(current, previous, "vs. mes anterior", "up-good"),
      series,
      seriesLabel: describeSeries(days, series.map((v) => formatPesos(v)), "cobrado por día"),
    });
  } else cards.push(unavailable(cdoBase));

  return { ok: true, data: cards };
}
