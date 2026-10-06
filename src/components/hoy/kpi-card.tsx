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
  // <2 puntos o serie toda en cero: no hay forma que mostrar.
  if (card.series.length < 2 || card.series.every((v) => v === 0)) return <span className="h-7 w-14 2xl:w-20" aria-hidden />;
  const color = TONE_STROKE[card.tone];
  if (card.chart === "bars") {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-7 w-14 min-w-[28px] flex-shrink 2xl:w-20", color)} aria-hidden>
        {buildBarRects(card.series, W, H, 2).map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.width} height={r.height} rx={2} fill="currentColor" opacity={i === card.series.length - 1 ? 1 : 0.7} />
        ))}
      </svg>
    );
  }
  const d = buildSparklinePath(card.series, W, H, 2);
  if (!d) return <span className="h-7 w-20" aria-hidden />;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-7 w-14 min-w-[28px] flex-shrink 2xl:w-20", color)} aria-hidden>
      <path vectorEffect="non-scaling-stroke" d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
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
    <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-snug">
      <span className={cn("inline-flex flex-shrink-0 items-center gap-0.5 whitespace-nowrap font-semibold tabular-nums", color)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {pct}
      </span>
      <span className="text-muted-foreground">{delta.comparison}</span>
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
        "group flex w-full min-w-0 items-start gap-3 p-4 xl:gap-2.5 xl:p-3.5 2xl:gap-3 2xl:p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      )}
    >
      <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full xl:h-9 xl:w-9 2xl:h-10 2xl:w-10", TONE_TILE[card.tone])}>
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-snug text-foreground [overflow-wrap:anywhere]">{card.label}</p>
        <div className="mt-1 flex items-end justify-between gap-2">
          <p className={cn("font-bold tabular-nums tracking-tight text-foreground", card.valueText ? "text-[26px] leading-8 xl:text-2xl 2xl:text-[26px]" : "text-sm leading-8 text-muted-foreground")}>
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
    <ul aria-label="Indicadores del día" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 min-[1400px]:grid-cols-5">
      {cards.map((card) => (
        <li key={card.id} className="flex min-w-0">
          <KpiCardView card={card} />
        </li>
      ))}
    </ul>
  );
}
