import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import type { KpiCard } from "@/lib/hoy/types";
import { lastNDayKeys, toDayKey } from "@/lib/hoy/derive/date-windows";
import { buildDelta } from "@/lib/hoy/derive/percent-delta";
import { displayStatus } from "@/lib/quotes/terms";
import { followUpState } from "@/lib/hoy/derive/common";

/** El indicador heredado debe incluir los siguientes pasos del Centro nuevo. */
export function withCommercialFollowups(
  cards: KpiCard[],
  data: Pick<
    CommercialSnapshot,
    "now" | "opportunities" | "contacts" | "quotes"
  >,
): KpiCard[] {
  const today = toDayKey(data.now)!;
  const days = lastNDayKeys(today, 7);
  const extra = data.opportunities.filter((o) => {
    if (["ganado", "perdido", "pausado"].includes(o.stage) || !o.nextActionDue)
      return false;
    const clientAction = data.contacts.find(
      (c) => c.id === o.clientId,
    )?.nextAction;
    // No contar otra vez un siguiente paso que el indicador ya conoce.
    if (
      clientAction &&
      typeof clientAction === "object" &&
      "dueAt" in clientAction &&
      "label" in clientAction && typeof clientAction.label === "string" && !!clientAction.label.trim() &&
      toDayKey(
        typeof clientAction.dueAt === "string" ? clientAction.dueAt : null,
      ) === o.nextActionDue
    )
      return false;
    const quote = data.quotes.find((q) => q.id === o.quoteId);
    if (
      quote &&
      toDayKey(quote.nextFollowUpAt) === o.nextActionDue &&
      ["hoy", "vencido"].includes(
        followUpState(
          {
            status: displayStatus(quote, new Date(data.now)),
            nextFollowUpAt: quote.nextFollowUpAt,
          },
          new Date(data.now),
        ) || "",
      )
    )
      return false;
    return true;
  });
  return cards.map((card) => {
    if (card.id !== "seguimientos" || card.valueText === null) return card;
    const series = days.map(
      (day, i) =>
        (card.series[i] || 0) +
        extra.filter((o) => o.nextActionDue === day).length,
    );
    const due = extra.filter((o) => o.nextActionDue! <= today).length;
    return {
      ...card,
      valueText: String(Number(card.valueText) + due),
      href: due > 0 ? "/ventas" : card.href,
      series,
      delta: buildDelta(
        series[6],
        series[5],
        "programados vs. ayer",
        "up-good",
      ),
      seriesLabel: `Últimos 7 días (seguimientos programados por día): ${series.join(", ")}`,
    };
  });
}
