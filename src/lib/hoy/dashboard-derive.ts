/**
 * Derivación pura del tablero (sin BD, sin `server-only`): la usan la página
 * vía `dashboard.ts` y los tests de render.
 */
import type { HoyViewId } from "@/components/hoy/hoy-views";
import type { ActivityFilter, HoyDashboard, WidgetResult } from "./types";
import type { HoySnapshot } from "./snapshot";
import { formatLongDateEs } from "./derive/date-windows";
import { deriveKpis } from "./derive/kpis";
import { derivePriorities } from "./derive/priority-order";
import { deriveChecklist } from "./derive/checklist-items";
import { deriveCobros } from "./derive/cobros";
import { deriveAlerts } from "./derive/alert-rules";
import { derivePipeline } from "./derive/pipeline-stages";
import { deriveActivity } from "./derive/activity";

/** Deriva todos los widgets de una instantánea (puro). */
export function deriveDashboard(
  snap: HoySnapshot,
  opts: { vista: HoyViewId; actividad: ActivityFilter; greetingName: string | null },
): HoyDashboard {
  const guard = <T,>(fn: () => WidgetResult<T>): WidgetResult<T> => {
    try {
      return fn();
    } catch (error) {
      console.error("[hoy] derivación falló:", error instanceof Error ? error.message : error);
      return { ok: false, error: "derive_failed" };
    }
  };
  return {
    greetingName: opts.greetingName,
    dateLabel: formatLongDateEs(snap.now),
    nowIso: snap.now.toISOString(),
    conversationsStatus: snap.conversations.status,
    kpis: guard(() => deriveKpis(snap)),
    prioridades: guard(() => derivePriorities(snap, opts.vista)),
    checklist: guard(() => deriveChecklist(snap)),
    cobros: guard(() => deriveCobros(snap)),
    alertas: guard(() => deriveAlerts(snap)),
    pipeline: guard(() => derivePipeline(snap)),
    actividad: guard(() => deriveActivity(snap, opts.actividad)),
  };
}

