import { describe, expect, it } from "vitest";
import { isNuevaConsumed, markNuevaConsumed, newNuevaToken } from "./nueva-cotizacion-intent";

/**
 * WO-2026-00519: `?nueva=<token>` es de un solo uso. El token se marca como
 * consumido en sessionStorage (sobrevive a refresh y a atrás/adelante en la
 * misma pestaña) sin tocar la URL — cambiar la URL remontaría la página.
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
} as unknown as Storage;

describe("intención «nueva cotización»", () => {
  it("cada clic genera un token distinto y legible en URL", () => {
    const a = newNuevaToken();
    const b = newNuevaToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[a-z0-9]+$/);
  });

  it("un token sin consumir abre; consumido ya no (refresh / atrás / adelante)", () => {
    const s = memoryStorage();
    expect(isNuevaConsumed("abc", s)).toBe(false);
    markNuevaConsumed("abc", s);
    expect(isNuevaConsumed("abc", s)).toBe(true);
    expect(isNuevaConsumed("otro", s)).toBe(false);
  });

  it("guarda solo los últimos 20 tokens", () => {
    const s = memoryStorage();
    for (let i = 0; i < 25; i++) markNuevaConsumed(`t${i}`, s);
    expect(isNuevaConsumed("t0", s)).toBe(false);
    expect(isNuevaConsumed("t24", s)).toBe(true);
  });

  it("storage bloqueado o corrupto ⇒ no consumido (abre, como antes) y sin lanzar", () => {
    expect(isNuevaConsumed("abc", broken)).toBe(false);
    expect(() => markNuevaConsumed("abc", broken)).not.toThrow();
    const s = memoryStorage();
    s.setItem("pixeltec:nueva-cotizacion:consumidas", "{no json");
    expect(isNuevaConsumed("abc", s)).toBe(false);
    expect(isNuevaConsumed("abc", null)).toBe(false);
  });
});
