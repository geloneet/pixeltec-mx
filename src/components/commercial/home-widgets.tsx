"use client";
import { deliveryLabel } from "./feedback";
import { withCommercialFollowups } from "./home-kpis";
import { useState } from "react";
import Link from "next/link";
import {
  Users,
  MessageCircle,
  FileText,
  CalendarClock,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import type { HoyDashboard, KpiCard } from "@/lib/hoy/types";
import { buildBarRects } from "@/lib/hoy/sparkline";
import { ActivityFeed } from "@/components/hoy/activity-feed";
import { ChecklistPanel } from "@/components/hoy/checklist-panel";
import { AlertsPanel } from "@/components/hoy/alerts-panel";
import { CobrosPanel } from "@/components/hoy/cobros-panel";
import type { ActivityFilter } from "@/lib/hoy/types";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";

const icons = {
  leads: Users,
  seguimientos: MessageCircle,
  cotizaciones: FileText,
  cobros: CalendarClock,
  cobrado: BarChart3,
};
const labels = [
  "Leads nuevos",
  "Seguimientos hoy",
  "Cotizaciones pendientes",
  "Cobros por vencer",
  "Cobrado este mes",
];

function Trend({ card }: { card: KpiCard }) {
  const delta = card.delta;
  const Icon =
    delta?.direction === "up"
      ? ArrowUpRight
      : delta?.direction === "down"
        ? ArrowDownRight
        : Minus;
  return (
    <div className="cc-kpi-trend">
      <span className={delta?.sentiment === "good" ? "positive" : ""}>
        <Icon size={13} aria-hidden />
        {delta
          ? delta.pct === null
            ? "Sin base"
            : `${delta.pct > 0 ? "+" : ""}${delta.pct}%`
          : "Sin comparación"}
      </span>
      {delta && <span>{delta.comparison}</span>}
    </div>
  );
}

export function HomeKpis({
  overview,
  error,
  data,
}: {
  overview?: HoyDashboard;
  error?: boolean;
  data: CommercialSnapshot;
}) {
  const cards = overview?.kpis.ok
    ? withCommercialFollowups(overview.kpis.data, data)
    : [];
  return (
    <div className="cc-home-kpis" aria-label="Indicadores comerciales">
      {cards.length
        ? cards.map((card) => {
            const Icon = icons[card.id];
            const hasSeries = card.valueText !== null && card.series.length > 0;
            return (
              <Link
                key={card.id}
                href={card.href}
                className="cc-home-kpi"
                data-kpi={card.id}
              >
                <div className="cc-kpi-label">
                  <Icon size={17} strokeWidth={1.7} aria-hidden />
                  <span>{card.label}</span>
                </div>
                <div className="cc-kpi-body">
                  <div className="cc-kpi-value">
                    <strong>{card.valueText ?? "Sin datos"}</strong>
                  </div>
                  <Trend card={card} />
                  {hasSeries && (
                    <svg
                      className="cc-kpi-bars"
                      viewBox="0 0 154 24"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      {buildBarRects(card.series, 154, 24, 5).map((rect, i) => (
                        <g key={i}>
                          {Array.from({ length: 3 }, (_, tick) => {
                            const width = (rect.width - 4) / 3;
                            const x = rect.x + tick * (width + 2);
                            return (
                              <g key={tick}>
                                <rect x={x} y={0} width={width} height={24} rx={2} fill="var(--cc-line)" />
                                <rect
                                  className="cc-chart-bar"
                                  style={{ animationDelay: `${i * 35}ms` }}
                                  x={x} y={rect.y} width={width} height={rect.height}
                                  fill={card.series[i] === 0 ? "var(--cc-line)" : "currentColor"}
                                  rx={2}
                                />
                              </g>
                            );
                          })}
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
                <span className="sr-only">{card.seriesLabel}</span>
              </Link>
            );
          })
        : labels.map((label) => (
            <div className="cc-home-kpi" key={label}>
              <span className="cc-kpi-label">{label}</span>
              <div className="cc-kpi-value">
                <strong>—</strong>
              </div>
              <p className="cc-muted">
                {error ? "No disponible" : "Cargando…"}
              </p>
            </div>
          ))}
    </div>
  );
}

export function HomeActivity({
  overview,
  error,
  data,
}: {
  overview?: HoyDashboard;
  error?: boolean;
  data: CommercialSnapshot;
}) {
  const [filter, setFilter] = useState<ActivityFilter>("todas");
  const result = overview?.actividad;
  const activity = result?.ok
    ? {
        ok: true as const,
        data: result.data.map((row) => {
          const source = data.activity.find((a) => "a:" + a.id === row.id);
          const metadata = source?.metadata;
          const direct =
            metadata &&
            typeof metadata === "object" &&
            "conversationId" in metadata &&
            typeof metadata.conversationId === "string"
              ? metadata.conversationId
              : undefined;
          const outboxId =
            metadata &&
            typeof metadata === "object" &&
            "outboxId" in metadata &&
            typeof metadata.outboxId === "string"
              ? metadata.outboxId
              : undefined;
          const conversationId =
            direct ||
            data.outbox.find((o) => o.id === outboxId)?.conversationId;
          const conversation = data.conversations.find(
            (c) => c.id === conversationId,
          );
          const delivery =
            metadata &&
            typeof metadata === "object" &&
            "delivery" in metadata &&
            typeof metadata.delivery === "string"
              ? metadata.delivery
              : row.title.startsWith("Envío comercial: ")
                ? row.title.slice("Envío comercial: ".length)
                : undefined;
          const title =
            delivery && deliveryLabel[delivery]
              ? "Mensaje · " + deliveryLabel[delivery]
              : row.title;
          if (
            conversation?.channel === "email" ||
            conversation?.channel === "whatsapp"
          )
            return {
              ...row,
              title,
              kind:
                conversation.channel === "email"
                  ? ("correo" as const)
                  : ("whatsapp" as const),
              href: "/whatsapp?conversation=" + conversation.id,
            };
          if (source?.type === "pago_registrado")
            return { ...row, kind: "cobro" as const, href: "/cobros" };
          return row;
        }),
      }
    : result;
  return (
    <div className="cc-home-activity">
      <ActivityFeed
        result={
          activity ||
          (error ? { ok: false, error: "load_failed" } : { ok: true, data: [] })
        }
        nowIso={overview?.nowIso || new Date().toISOString()}
        filter={filter}
        onFilter={setFilter}
        loading={!overview && !error}
      />
    </div>
  );
}

export function HomeSecondary({ overview }: { overview?: HoyDashboard }) {
  if (!overview) return null;
  return (
    <div className="cc-home-secondary">
      <ChecklistPanel result={overview.checklist} nowIso={overview.nowIso} />
      <details className="cc-home-secondary-details">
        <summary>Cobros y pagos</summary>
        <CobrosPanel result={overview.cobros} />
      </details>
      <AlertsPanel result={overview.alertas} nowIso={overview.nowIso} />
    </div>
  );
}
