"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { BarChart3, ArrowUpRight } from "lucide-react";
import type { HoyDashboard } from "@/lib/hoy/types";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { lastNDayKeys, toDayKey } from "@/lib/hoy/derive/date-windows";
import { withCommercialFollowups } from "./home-kpis";
import { dateLabel } from "./data";
const recordLabel = (value: number) =>
  `${value} ${value === 1 ? "registro" : "registros"}`;
const choices = [
  { id: "leads", label: "Leads", unit: "leads nuevos" },
  {
    id: "seguimientos",
    label: "Seguimientos",
    unit: "seguimientos programados",
  },
  { id: "cotizaciones", label: "Cotizaciones", unit: "cotizaciones enviadas" },
] as const;
export function HomeTrend({
  overview,
  data,
  error,
}: {
  overview?: HoyDashboard;
  error?: boolean;
  data: CommercialSnapshot;
}) {
  const fillId = useId();
  const [selected, setSelected] =
    useState<(typeof choices)[number]["id"]>("seguimientos");
  const [point, setPoint] = useState(6);
  const card = overview?.kpis.ok
    ? withCommercialFollowups(overview.kpis.data, data).find(
        (c) => c.id === selected,
      )
    : undefined;
  const available = card?.valueText !== null && !!card?.series.length;
  const values = available ? card!.series : [];
  const days = lastNDayKeys(
    toDayKey(overview?.nowIso || data.now)!,
    values.length,
  );
  const max = Math.ceil(Math.max(...values, 1) / 2) * 2,
    w = 560,
    h = 120;
  const points = values.map((v, i) => ({
    x: 8 + (i * (w - 16)) / Math.max(values.length - 1, 1),
    y: 8 + (h - 16) * (1 - v / max),
  }));
  const path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const index = Math.min(point, Math.max(values.length - 1, 0));
  const unit = choices.find((c) => c.id === selected)!.unit;
  return (
    <section
      className="cc-home-panel cc-home-trend"
      aria-labelledby="home-trend-title"
    >
      <div className="cc-home-panel-head">
        <div>
          <span className="cc-trend-heading">
            <span className="cc-record-icon">
              <BarChart3 size={18} />
            </span>
            <h2 id="home-trend-title">Actividad de la semana</h2>
          </span>
          <p>Registros diarios · últimos 7 días</p>
        </div>
        <Link className="cc-text-action" href={card?.href || "/ventas"}>
          Abrir detalle <ArrowUpRight size={14} />
        </Link>
      </div>
      <div className="cc-trend-body">
        <div className="cc-trend-toolbar">
          <div>
            <strong>
              {available ? values.reduce((a, b) => a + b, 0) : "—"}
            </strong>
            <span>{unit}</span>
          </div>
          <div className="cc-choice" aria-label="Serie de actividad">
            {choices.map((c) => (
              <button
                key={c.id}
                aria-pressed={selected === c.id}
                onClick={() => {
                  setSelected(c.id);
                  setPoint(6);
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {available ? (
          <>
            <div className="cc-trend-readout sr-only" aria-live="polite">
              <span>{dateLabel(days[index])}</span>
              <strong>{recordLabel(values[index])}</strong>
            </div>
            <div className="cc-trend-chart">
              <div className="cc-trend-axis" aria-hidden>
                <span>{max}</span>
                <span>{max / 2}</span>
                <span>0</span>
              </div>
              <div className="cc-trend-canvas">
                <svg
                  className="cc-trend-plot"
                  viewBox={`0 0 ${w} ${h}`}
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={card!.seriesLabel}
                >
                  <defs>
                    <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--cc-blue)" stopOpacity="0.15" />
                      <stop offset="100%" stopColor="var(--cc-blue)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <rect
                    x={Math.min(w - 40, Math.max(0, points[index].x - 20))}
                    y="8" width="40" height={h - 16}
                    className="cc-trend-selection"
                  />
                  {[0, 0.5, 1].map((v) => (
                    <line
                      key={v}
                      x1="0"
                      x2={w}
                      y1={8 + (h - 16) * v}
                      y2={8 + (h - 16) * v}
                      className="cc-trend-grid"
                    />
                  ))}
                  {points.map((p, i) => (
                    <line
                      key={i}
                      x1={p.x}
                      x2={p.x}
                      y1="0"
                      y2={h}
                      className="cc-trend-grid"
                    />
                  ))}
                  <path
                    d={`${path} L${points.at(-1)!.x},${h} L${points[0].x},${h} Z`}
                    fill={`url(#${fillId})`}
                  />
                  <path
                    d={path}
                    fill="none"
                    className="cc-chart-line cc-trend-line"
                    pathLength={1}
                  />
                  <line
                    x1={points[index].x} x2={points[index].x}
                    y1="8" y2={h - 8}
                    className="cc-trend-selection-line"
                  />
                  {points.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={i === index ? 5 : 3}
                      className={
                        i === index ? "cc-trend-point selected" : "cc-trend-point"
                      }
                      onMouseEnter={() => setPoint(i)}
                    >
                      <title>
                        {dateLabel(days[i])}: {recordLabel(values[i])}
                      </title>
                    </circle>
                  ))}
                </svg>
                <div
                  className="cc-trend-tooltip"
                  aria-hidden
                  style={{
                    left: `${Math.min(78, Math.max(22, (points[index].x / w) * 100))}%`,
                    top: `${Math.min(58, Math.max(12, (points[index].y / h) * 100 - 18))}%`,
                  }}
                >
                  <span>{dateLabel(days[index])}</span>
                  <strong>{recordLabel(values[index])}</strong>
                  <small>{unit}</small>
                </div>
              </div>
            </div>
            <div className="cc-trend-days">
              {days.map((day, i) => (
                <button
                  key={day}
                  aria-pressed={index === i}
                  aria-label={`${dateLabel(day)}: ${recordLabel(values[i])}`}
                  onClick={() => setPoint(i)}
                >
                  {dateLabel(day)}
                </button>
              ))}
            </div>
            {values.every((v) => v === 0) && (
              <p className="cc-trend-empty">
                Sin registros de esta serie en los últimos siete días.
              </p>
            )}
          </>
        ) : (
          <p className="cc-trend-empty">
            {overview || error
              ? "Esta serie no está disponible. Revisa sus datos desde el detalle."
              : "Cargando actividad…"}
          </p>
        )}
      </div>
    </section>
  );
}
