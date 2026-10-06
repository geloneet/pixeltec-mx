import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, BarChart3, CalendarClock, Clock, MessageCircle, Minus, Users, type LucideIcon } from "lucide-react";
import type { KpiCard, KpiId, WidgetResult } from "@/lib/hoy/types";
import { buildBarRects, buildSparklinePath } from "@/lib/hoy/sparkline";
import { cn } from "@/lib/utils";
import { CARD, TONE_STROKE, TONE_TILE } from "./tones";
import { WidgetError } from "./states";

const ICONS: Record<KpiId, LucideIcon> = {
  leads: Users,
  seguimientos: MessageCircle,
  cotizaciones: Clock,
  cobros: CalendarClock,
  cobrado: BarChart3,
};

const W = 80;
const H = 28;

function Sparkline({ card }: { card: KpiCard }) {
  if (card.series.length < 2) return <span className="h-7 w-20" aria-hidden />;
  const color = TONE_STROKE[card.tone];
  if (card.chart === "bars") {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn("flex-shrink-0", color)} aria-hidden>
        {buildBarRects(card.series, W, H, 2).map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} rx={2} fill="currentColor" opacity={i === card.series.length - 1 ? 1 : 0.7} />
        ))}
      </svg>
    );
  }
  const d = buildSparklinePath(card.series, W, H, 2);
  if (!d) return <span className="h-7 w-20" aria-hidden />;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={cn("flex-shrink-0", color)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Delta({ card }: { card: KpiCard }) {
  const delta = card.delta;
  if (!delta) return <p className="text-xs text-muted-foreground">Sin comparación</p>;
  const Icon = delta.direction === "up" ? ArrowUpRight : delta.direction === "down" ? ArrowDownRight : Minus;
  const color =
    delta.sentiment === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : delta.sentiment === "bad"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";
  const pct = delta.pct === null ? "sin base" : `${delta.pct > 0 ? "+" : ""}${delta.pct}%`;
  return (
    <p className="flex items-center gap-1 text-xs">
      <span className={cn("inline-flex items-center gap-0.5 font-semibold tabular-nums", color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {pct}
      </span>
      <span className="truncate text-muted-foreground">{delta.comparison}</span>
    </p>
  );
}

export function KpiCardView({ card }: { card: KpiCard }) {
  const Icon = ICONS[card.id];
  return (
    <Link
      href={card.href}
      data-kpi={card.id}
      className={cn(
        CARD,
        "group flex min-w-0 items-start gap-3 p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full", TONE_TILE[card.tone])}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{card.label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className={cn("font-bold tabular-nums tracking-tight text-foreground", card.valueText ? "text-[26px] leading-8" : "text-sm leading-8 text-muted-foreground")}>
            {card.valueText ?? "Sin datos"}
          </p>
          <Sparkline card={card} />
        </div>
        <div className="mt-1">
          <Delta card={card} />
        </div>
        <p className="sr-only">{card.seriesLabel}</p>
      </div>
    </Link>
  );
}

export function KpiRow({ result, visible }: { result: WidgetResult<KpiCard[]>; visible?: ReadonlySet<KpiId> }) {
  if (!result.ok) {
    return (
      <div className={cn(CARD, "px-5")}>
        <WidgetError what="los indicadores" />
      </div>
    );
  }
  const cards = visible ? result.data.filter((c) => visible.has(c.id)) : result.data;
  if (cards.length === 0) return null;
  return (
    <ul aria-label="Indicadores del día" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <li key={card.id} className="min-w-0">
          <KpiCardView card={card} />
        </li>
      ))}
    </ul>
  );
}
