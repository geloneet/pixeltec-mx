/**
 * Intención «+ Nueva cotización» de un solo uso (WO-2026-00519).
 *
 * El botón del topbar navega a `/clientes/[id]?tab=cotizaciones&nueva=<token>`
 * con un token nuevo por clic. La pestaña Cotizaciones abre el formulario si
 * el token no se ha consumido, y lo marca consumido en sessionStorage al salir
 * del formulario, en `pagehide` (refresh/cierre) o al navegar a otra parte.
 * Así refresh y atrás/adelante (misma pestaña del navegador) conservan
 * `?tab=cotizaciones` pero NO reabren el formulario.
 *
 * Por qué no se limpia `nueva` de la URL: en el App Router la clave del
 * segmento de página incluye los search params; cambiarlos (incluso con
 * `history.replaceState`) remonta la página, recarga las cotizaciones y el
 * formulario recién abierto se pierde (verificado en navegador).
 *
 * Sin storage (bloqueado / modo privado estricto) ⇒ el token cuenta como no
 * consumido: se abre el formulario, igual que antes de esta WO.
 */
const KEY = "pixeltec:nueva-cotizacion:consumidas";
const MAX = 20;

export function newNuevaToken(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function read(storage: Storage | null | undefined): string[] {
  try {
    const raw = storage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function isNuevaConsumed(token: string, storage: Storage | null | undefined): boolean {
  return read(storage).includes(token);
}

export function markNuevaConsumed(token: string, storage: Storage | null | undefined): void {
  try {
    const next = [...read(storage).filter((t) => t !== token), token].slice(-MAX);
    storage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Sin storage: degradación documentada arriba.
  }
}

/** sessionStorage del navegador, o `null` (SSR o acceso bloqueado). */
export function browserSessionStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}
