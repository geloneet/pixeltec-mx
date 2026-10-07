"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, Mail, Receipt, UserPlus, Users, type LucideIcon } from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import type { ActivityFilter, ActivityKind, ActivityRow, Tone, WidgetResult } from "@/lib/hoy/types";
import { ACTIVITY_FILTERS } from "@/lib/hoy/derive/activity";
import { formatDayEs, formatRelativeEs } from "@/lib/hoy/derive/date-windows";
import { cn } from "@/lib/utils";
import { CARD, TONE_TILE } from "./tones";
import { EmptyState, WidgetError } from "./states";

const KIND: Record<ActivityKind, { icon: LucideIcon | typeof SiWhatsapp; tone: Tone }> = {
  whatsapp: { icon: SiWhatsapp, tone: "emerald" },
  correo: { icon: Mail, tone: "blue" },
  cotizacion: { icon: FileText, tone: "blue" },
  cobro: { icon: Receipt, tone: "emerald" },
  lead: { icon: UserPlus, tone: "violet" },
  cliente: { icon: Users, tone: "slate" },
};

const COLLAPSED = 4;

const EMPTY: Record<ActivityFilter, string> = {
  todas: "Aún no hay actividad.",
  whatsapp: "Aún no hay mensajes de WhatsApp.",
  correo: "Aún no hay correos registrados.",
  cotizaciones: "Aún no hay cotizaciones enviadas, aceptadas ni rechazadas.",
  cobros: "Aún no hay pagos registrados.",
};

const absolute = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});
const absoluteDay = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });

/** Fecha (CDMX) para el tooltip; con hora solo si la hora es real. */
function formatAbsolute(iso: string, dayOnly: boolean): string | undefined {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return (dayOnly ? absoluteDay : absolute).format(d);
}

/** Actividad reciente: filtros `?actividad=` (enlaces) y despliegue local. */
export function ActivityFeed({
  result,
  nowIso,
  filter,
}: {
  result: WidgetResult<ActivityRow[]>;
  nowIso: string;
  filter: ActivityFilter;
}) {
  const [expanded, setExpanded] = useState(false);
  const now = new Date(nowIso);
  const rows = result.ok ? result.data : [];
  const shown = expanded ? rows : rows.slice(0, COLLAPSED);

  return (
    <section aria-labelledby="actividad-title" className={cn(CARD, "px-5 py-4")}>
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h2 id="actividad-title" className="text-base font-semibold tracking-tight text-foreground">
          Actividad reciente
        </h2>
        <nav aria-label="Filtrar actividad">
          <ul className="flex flex-wrap items-center gap-1">
            {ACTIVITY_FILTERS.map((f) => {
              const active = f.id === filter;
              return (
                <li key={f.id}>
                  <Link
                    href={f.id === "todas" ? "/hoy" : `/hoy?actividad=${f.id}`}
                    scroll={false}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "block rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {rows.length > COLLAPSED && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="ml-auto inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? "Ver menos" : "Ver toda la actividad"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </header>

      <div className="mt-3">
        {!result.ok ? (
          <WidgetError what="la actividad" />
        ) : rows.length === 0 ? (
          <EmptyState>{EMPTY[filter]}</EmptyState>
        ) : (
          <ul className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
            {shown.map((row) => {
              const k = KIND[row.kind];
              const Icon = k.icon;
              return (
                <li key={row.id} className="min-w-0">
                  <Link
                    href={row.href}
                    title={[row.title, row.subtitle, row.amount].filter(Boolean).join(" · ")}
                    className="flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full", TONE_TILE[k.tone])}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {/* WO-2026-00519 (polish): el título envuelve completo y la hora va
                        debajo — a la derecha competía con el título y lo recortaba
                        («Cotización e…») en el grid de 4 columnas. */}
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-[13px] font-semibold leading-snug text-foreground">{row.title}</span>
                      {row.subtitle && <span className="block truncate text-xs text-muted-foreground">{row.subtitle}</span>}
                      {row.amount && (
                        <span className="block truncate text-xs font-medium tabular-nums text-foreground">{row.amount}</span>
                      )}
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span aria-hidden className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                        <time dateTime={row.at} title={formatAbsolute(row.at, row.precision === "day")}>
                          {row.precision === "day" ? formatDayEs(row.at, now) : formatRelativeEs(row.at, now)}
                        </time>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
