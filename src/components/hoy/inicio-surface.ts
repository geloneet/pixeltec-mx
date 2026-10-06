import { isModuleVisible, type ModuleId } from "@/lib/modules/registry";

/**
 * Superficie de /hoy («Inicio») — WO-2026-00515 «Centro Comercial».
 *
 * Cada widget pertenece a un módulo del registro central y solo se renderiza
 * si ese módulo es visible. Reactivar/ocultar un módulo en `registry.ts`
 * enciende/apaga sus widgets sin tocar esta página. (Reemplaza los accesos
 * rápidos y KPIs de WO-2026-00132.)
 */
export const INICIO_WIDGETS = {
  kpiLeads: "clientes",
  kpiSeguimientos: "cotizaciones",
  kpiCotizaciones: "cotizaciones",
  kpiCobros: "finanzas",
  kpiCobrado: "finanzas",
  prioridades: "clientes",
  checklist: "inicio",
  cobros: "finanzas",
  alertas: "inicio",
  pipeline: "clientes",
  actividad: "clientes",
  conversaciones: "whatsapp",
} as const satisfies Record<string, ModuleId>;

export type InicioWidget = keyof typeof INICIO_WIDGETS;

export function isInicioWidgetVisible(widget: InicioWidget): boolean {
  return isModuleVisible(INICIO_WIDGETS[widget]);
}

export function getVisibleInicioWidgets(): InicioWidget[] {
  return (Object.keys(INICIO_WIDGETS) as InicioWidget[]).filter(isInicioWidgetVisible);
}
