import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserSession } from "@/lib/auth/session";
import { getHoyDashboard } from "@/lib/hoy/dashboard";
import { parseActivityFilter } from "@/lib/hoy/derive/activity";
import type { KpiId } from "@/lib/hoy/types";
import { getHoyView, parseHoyView } from "@/components/hoy/hoy-views";
import { isInicioWidgetVisible, type InicioWidget } from "@/components/hoy/inicio-surface";
import { HoyHeader } from "@/components/hoy/hoy-header";
import { HoyViewTabs } from "@/components/hoy/hoy-view-tabs";
import { KpiRow } from "@/components/hoy/kpi-card";
import { PrioritiesPanel } from "@/components/hoy/priorities-panel";
import { ChecklistPanel } from "@/components/hoy/checklist-panel";
import { CobrosPanel } from "@/components/hoy/cobros-panel";
import { AlertsPanel } from "@/components/hoy/alerts-panel";
import { PipelineBoard } from "@/components/hoy/pipeline-board";
import { ActivityFeed } from "@/components/hoy/activity-feed";

export const metadata: Metadata = {
  title: "Inicio — Pixeltec.mx",
};

export const dynamic = "force-dynamic";

const KPI_WIDGETS: Record<KpiId, InicioWidget> = {
  leads: "kpiLeads",
  seguimientos: "kpiSeguimientos",
  cotizaciones: "kpiCotizaciones",
  cobros: "kpiCobros",
  cobrado: "kpiCobrado",
};

/**
 * Inicio «Centro Comercial» (WO-2026-00515). La ruta /hoy se conserva.
 *
 * - La sesión se resuelve UNA vez aquí (`requireUserSession`: users.id + rol
 *   desde la autoridad canónica) y `ownerId` baja a los loaders.
 * - Datos reales en solo lectura; sin dato ⇒ estado vacío honesto.
 * - Cada widget se pinta solo si su módulo es visible (registro central).
 */
export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireUserSession();
  if (!session) redirect("/login?redirect=/hoy");

  const params = await searchParams;
  const vista = parseHoyView(params.vista);
  const actividad = parseActivityFilter(params.actividad);
  const canConversations = session.role === "admin" && isInicioWidgetVisible("conversaciones");

  const d = await getHoyDashboard(session.userId, new Date(), { vista, actividad, canConversations });

  const visibleKpis = new Set(
    (Object.keys(KPI_WIDGETS) as KpiId[]).filter((id) => isInicioWidgetVisible(KPI_WIDGETS[id])),
  );
  const show = (w: InicioWidget) => isInicioWidgetVisible(w);
  const conversationsNote =
    d.conversationsStatus === "unavailable" ? "Sin datos de conversaciones: PixelBot no respondió. Se muestran el resto de las prioridades." : null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-5">
      <HoyHeader name={d.greetingName} dateLabel={d.dateLabel} />

      {/* Vistas: en el topbar desde xl; aquí como pills por debajo de xl. */}
      <HoyViewTabs className="xl:hidden" />

      {visibleKpis.size > 0 && <KpiRow result={d.kpis} visible={visibleKpis} />}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          {show("prioridades") && (
            <PrioritiesPanel
              result={d.prioridades}
              title={getHoyView(vista).panelTitle}
              nowIso={d.nowIso}
              conversationsNote={conversationsNote}
            />
          )}
          {show("pipeline") && (
            <div className="hidden xl:block">
              <PipelineBoard result={d.pipeline} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {show("checklist") && <ChecklistPanel result={d.checklist} nowIso={d.nowIso} />}
          {show("cobros") && <CobrosPanel result={d.cobros} />}
          {show("alertas") && <AlertsPanel result={d.alertas} nowIso={d.nowIso} />}
        </div>
      </div>

      {/* Bajo xl el pipeline va después de la columna lateral (una sola columna). */}
      {show("pipeline") && (
        <div className="xl:hidden">
          <PipelineBoard result={d.pipeline} />
        </div>
      )}

      {show("actividad") && <ActivityFeed result={d.actividad} nowIso={d.nowIso} filter={actividad} />}
    </div>
  );
}
