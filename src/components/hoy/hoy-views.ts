import type { ModuleId } from "@/lib/modules/registry";

/**
 * Vistas del segmented control del topbar en /hoy (WO-2026-00515, D-6).
 * No son rutas nuevas: son `/hoy?vista=<id>` y filtran el panel de
 * Prioridades. Todas pertenecen al módulo `inicio` del registro central.
 */
export const HOY_VIEW_IDS = ["hoy", "pendientes", "cotizaciones", "cobros", "clientes-activos"] as const;
export type HoyViewId = (typeof HOY_VIEW_IDS)[number];

export interface HoyView {
  id: HoyViewId;
  label: string;
  /** Título del panel de prioridades en esta vista. */
  panelTitle: string;
  href: string;
  module: ModuleId;
}

export const DEFAULT_HOY_VIEW: HoyViewId = "hoy";

function hrefFor(id: HoyViewId): string {
  return id === DEFAULT_HOY_VIEW ? "/hoy" : `/hoy?vista=${id}`;
}

export const HOY_VIEWS: readonly HoyView[] = [
  { id: "hoy", label: "Hoy", panelTitle: "Prioridades de hoy" },
  { id: "pendientes", label: "Pendientes", panelTitle: "Pendientes vencidos y de hoy" },
  { id: "cotizaciones", label: "Cotizaciones", panelTitle: "Cotizaciones en curso" },
  { id: "cobros", label: "Cobros", panelTitle: "Cobros pendientes" },
  { id: "clientes-activos", label: "Clientes activos", panelTitle: "Prioridades de clientes activos" },
].map((v) => ({ ...v, id: v.id as HoyViewId, href: hrefFor(v.id as HoyViewId), module: "inicio" as const }));

export function parseHoyView(raw: string | string[] | undefined | null): HoyViewId {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (HOY_VIEW_IDS as readonly string[]).includes(value ?? "") ? (value as HoyViewId) : DEFAULT_HOY_VIEW;
}

export function getHoyView(id: HoyViewId): HoyView {
  return HOY_VIEWS.find((v) => v.id === id) ?? HOY_VIEWS[0];
}
