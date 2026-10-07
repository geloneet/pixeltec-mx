import { describe, expect, it } from "vitest";
import { consumeNuevaIntent, hasNuevaIntent, markNuevaIntent } from "./nueva-cotizacion-intent";

/**
 * WO-2026-00519: «+ Nueva cotización» deja una intención de un solo uso en
 * sessionStorage (por cliente) y navega a `?tab=cotizaciones&nueva=1`. La
 * pestaña abre el formulario solo si la intención sigue pendiente; refresh y
 * atrás/adelante ya no la encuentran.
 */
function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  };
}

const broken = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
} as unknown as Storage;

describe("intención «nueva cotización»", () => {
  it("pendiente para el cliente elegido, no para otros", () => {
    const s = memoryStorage();
    expect(hasNuevaIntent("c1", s)).toBe(false);
    markNuevaIntent("c1", s);
    expect(hasNuevaIntent("c1", s)).toBe(true);
    expect(hasNuevaIntent("c2", s)).toBe(false);
  });

  it("consumir la borra (refresh / atrás / adelante ya no reabren)", () => {
    const s = memoryStorage();
    markNuevaIntent("c1", s);
    consumeNuevaIntent("c1", s);
    expect(hasNuevaIntent("c1", s)).toBe(false);
  });

  it("consumir para otro cliente no borra la intención vigente", () => {
    const s = memoryStorage();
    markNuevaIntent("c2", s);
    consumeNuevaIntent("c1", s);
    expect(hasNuevaIntent("c2", s)).toBe(true);
  });

  it("storage bloqueado o ausente ⇒ null (desconocido) y sin lanzar", () => {
    expect(hasNuevaIntent("c1", broken)).toBeNull();
    expect(hasNuevaIntent("c1", null)).toBeNull();
    expect(() => markNuevaIntent("c1", broken)).not.toThrow();
    expect(() => consumeNuevaIntent("c1", broken)).not.toThrow();
  });

  it("valor corrupto ⇒ sin intención", () => {
    const s = memoryStorage();
    s.setItem("pixeltec:nueva-cotizacion:intencion", "{no json");
    expect(hasNuevaIntent("c1", s)).toBe(false);
  });
});
