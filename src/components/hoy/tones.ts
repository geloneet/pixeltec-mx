import type { Tone } from "@/lib/hoy/types";

/**
 * Tonos semánticos del Centro Comercial (claro: `X-50/X-700`; oscuro:
 * `X-500/15 + X-300`). Clases literales para que Tailwind las detecte.
 * El color nunca va solo: todo chip lleva texto.
 */
export const TONE_CHIP: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  red: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
};

/** Icono tintado 40×40 de KPI/alerta/actividad. */
export const TONE_TILE: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300",
  red: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
  emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

/** Trazo/relleno del sparkline (usa currentColor). */
export const TONE_STROKE: Record<Tone, string> = {
  blue: "text-blue-600 dark:text-blue-400",
  violet: "text-violet-600 dark:text-violet-400",
  amber: "text-amber-500 dark:text-amber-400",
  orange: "text-orange-500 dark:text-orange-400",
  red: "text-red-500 dark:text-red-400",
  emerald: "text-emerald-500 dark:text-emerald-400",
  slate: "text-slate-500 dark:text-slate-400",
};

/** Fondo de columna del kanban (tinte muy suave) y título de la etapa. */
export const TONE_COLUMN: Record<Tone, { column: string; title: string }> = {
  blue: { column: "bg-blue-50/70 dark:bg-blue-500/[0.07]", title: "text-blue-700 dark:text-blue-300" },
  violet: { column: "bg-violet-50/70 dark:bg-violet-500/[0.07]", title: "text-violet-700 dark:text-violet-300" },
  amber: { column: "bg-amber-50/70 dark:bg-amber-500/[0.07]", title: "text-amber-800 dark:text-amber-300" },
  orange: { column: "bg-orange-50/70 dark:bg-orange-500/[0.07]", title: "text-orange-700 dark:text-orange-300" },
  red: { column: "bg-red-50/70 dark:bg-red-500/[0.07]", title: "text-red-700 dark:text-red-300" },
  emerald: { column: "bg-emerald-50/70 dark:bg-emerald-500/[0.07]", title: "text-emerald-700 dark:text-emerald-300" },
  slate: { column: "bg-slate-100/70 dark:bg-slate-500/[0.07]", title: "text-slate-700 dark:text-slate-300" },
};

export const CARD =
  "rounded-xl border border-border bg-card text-card-foreground shadow-[var(--crm-shadow)] dark:ring-1 dark:ring-white/5";
