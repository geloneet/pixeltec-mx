/**
 * Intención «+ Nueva cotización» de un solo uso (WO-2026-00519).
 *
 * El botón del topbar guarda en sessionStorage el cliente elegido y navega a
 * `/clientes/[id]?tab=cotizaciones&nueva=1` (contrato de URL de WO-2026-00515).
 * La pestaña Cotizaciones abre el formulario nuevo solo si esa intención sigue
 * pendiente para ese cliente, y la consume al salir del formulario
 * (cancelar/guardar), en `pagehide` (refresh/cierre) o al navegar a otra
 * parte. Así refresh y atrás/adelante (misma pestaña del navegador) conservan
 * `?tab=cotizaciones` pero NO reabren el formulario.
 *
 * Por qué no se limpia `nueva` de la URL ni se consume al montar (ambas cosas
 * verificadas en navegador): en el App Router cambiar los search params
 * remonta la página, y el `AnimatePresence` del shell remonta la página al
 * terminar la animación de entrada; en los dos casos el formulario recién
 * abierto se perdía.
 *
 * Sin storage (bloqueado / modo privado estricto) la intención es
 * desconocida (`null`) y la pestaña abre el formulario, como antes.
 */
const KEY = "pixeltec:nueva-cotizacion:intencion";

export function markNuevaIntent(clientId: string, storage: Storage | null | undefined): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ clientId }));
  } catch {
    // Sin storage: degradación documentada arriba.
  }
}

/** `true`/`false` si se pudo leer; `null` si el storage no está disponible. */
export function hasNuevaIntent(clientId: string, storage: Storage | null | undefined): boolean | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return null;
  }
  try {
    const v: unknown = raw ? JSON.parse(raw) : null;
    return !!v && typeof v === "object" && (v as { clientId?: unknown }).clientId === clientId;
  } catch {
    return false;
  }
}

export function consumeNuevaIntent(clientId: string, storage: Storage | null | undefined): void {
  try {
    if (hasNuevaIntent(clientId, storage)) storage?.removeItem(KEY);
  } catch {
    // Sin storage: nada que consumir.
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
