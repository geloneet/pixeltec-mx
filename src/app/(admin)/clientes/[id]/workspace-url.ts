/**
 * Pestaña del workspace de cliente ↔ URL (`?tab=`, `?sub=`). Módulo puro.
 *
 * WO-2026-00519: la pestaña vive en la URL para que refresh, atrás y adelante
 * la conserven. «+ Nueva cotización» (/hoy) llega con
 * `?tab=cotizaciones&nueva=1`; `nueva` lo resuelve la propia pestaña de
 * Cotizaciones (intención de un solo uso), aquí solo se ignora.
 */
import type { WorkspaceTab } from "@/components/crm/ClientWorkspace";
import type { ComercialSub } from "@/components/crm/workspace-tabs/ComercialTab";
import type { ClientWorkspaceSection } from "@/lib/modules/client-workspace";
import { consumeNuevaIntent } from "@/components/hoy/nueva-cotizacion-intent";

/** Todas las secciones del workspace; la visibilidad la decide el registro. */
const VALID_TABS: readonly WorkspaceTab[] = [
  "resumen",
  "cotizaciones",
  "proyectos",
  "comercial",
  "documentos",
  "finanzas",
  "portal",
];

const VALID_SUBS: readonly ComercialSub[] = ["propuestas", "contratos", "facturacion"];

/** Deep-links previos a ADR-0035 (emails, notificaciones, enlaces guardados):
 *  jamás 404 — cada tab viejo cae en su nuevo hogar. OJO: `documentos` viejo
 *  era facturación; el tab `documentos` nuevo (expediente) solo se alcanza
 *  desde la UI. */
const TAB_MIGRATION: Record<string, { tab: WorkspaceTab; sub?: ComercialSub }> = {
  propuesta: { tab: "comercial", sub: "propuestas" },
  contratos: { tab: "comercial", sub: "contratos" },
  documentos: { tab: "comercial", sub: "facturacion" },
  discovery: { tab: "resumen" },
  estrategia: { tab: "resumen" },
};

export interface WorkspaceUrlState {
  /** `undefined` ⇒ el workspace abre en Resumen. */
  tab?: WorkspaceTab;
  sub?: ComercialSub;
}

/**
 * Lee la pestaña de la URL. Pestaña inválida, ausente u oculta por el
 * registro (WO-2026-00088) ⇒ `undefined` (Resumen): jamás 404 ni vacío.
 */
export function resolveWorkspaceUrl(
  params: Pick<URLSearchParams, "get">,
  isVisible: (id: ClientWorkspaceSection) => boolean,
): WorkspaceUrlState {
  const tabParam = params.get("tab");
  const subParam = params.get("sub");
  const migrated = tabParam ? TAB_MIGRATION[tabParam] : undefined;
  const requested = migrated?.tab ?? VALID_TABS.find((t) => t === tabParam);
  const tab = requested && isVisible(requested) ? requested : undefined;
  const sub = migrated?.sub ?? VALID_SUBS.find((s) => s === subParam);
  return sub ? { tab, sub } : { tab };
}

/**
 * Query string para cambiar de pestaña: fija `tab`, descarta `nueva` (la
 * intención de formulario nuevo no viaja a otras pestañas) y `sub` fuera de Comercial; conserva lo demás.
 * La usa el clic de pestaña → URL (WO-2026-00526, vía `workspaceTabHref`).
 */
export function workspaceTabSearch(current: URLSearchParams, tab: WorkspaceTab): string {
  const next = new URLSearchParams(current);
  next.set("tab", tab);
  next.delete("nueva");
  if (tab !== "comercial") next.delete("sub");
  // `tab` primero: URLs legibles y estables.
  const ordered = new URLSearchParams([["tab", tab], ...[...next].filter(([k]) => k !== "tab")]);
  return `?${ordered.toString()}`;
}

/** href completo (pathname + query) para `router.replace` al cambiar de pestaña (WO-2026-00526). */
export function workspaceTabHref(
  pathname: string,
  current: URLSearchParams | null,
  tab: WorkspaceTab,
): string {
  return pathname + workspaceTabSearch(new URLSearchParams(current ?? undefined), tab);
}

/**
 * Cambiar de pestaña con `?nueva=1` en la URL abandona el formulario nuevo:
 * consume la intención de un solo uso (WO-2026-00526). Hace falta porque
 * CotizacionesTab se desmonta antes de que `router.replace` cambie la URL y su
 * limpieza («desmontarse con otra URL») aún ve la URL vieja (medido en navegador).
 */
export function consumeNuevaOnTabChange(
  current: Pick<URLSearchParams, "get"> | null,
  clientId: string,
  storage: Storage | null | undefined,
): void {
  if (current?.get("nueva") === "1") consumeNuevaIntent(clientId, storage);
}
