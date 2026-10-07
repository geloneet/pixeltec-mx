import { describe, expect, it } from "vitest";
import type { ClientWorkspaceSection } from "@/lib/modules/client-workspace";
import { markNuevaIntent, hasNuevaIntent } from "@/components/hoy/nueva-cotizacion-intent";
import { consumeNuevaOnTabChange, resolveWorkspaceUrl, workspaceTabHref, workspaceTabSearch } from "./workspace-url";

/**
 * WO-2026-00519: la pestaña del workspace de cliente vive en la URL (`?tab=`),
 * así que refresh, atrás y adelante la conservan. «+ Nueva cotización» llega
 * con `?tab=cotizaciones&nueva=1`.
 */
const allVisible = () => true;
const onlyActive = (id: ClientWorkspaceSection) => ["resumen", "cotizaciones", "finanzas"].includes(id);

describe("resolveWorkspaceUrl", () => {
  it("?tab=cotizaciones aterriza en Cotizaciones (antes caía en Resumen)", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=cotizaciones"), onlyActive).tab).toBe("cotizaciones");
  });

  it("?tab=cotizaciones&nueva=1 conserva la pestaña (nueva lo consume la propia pestaña)", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=cotizaciones&nueva=1"), onlyActive).tab).toBe("cotizaciones");
  });

  it("?tab=finanzas también es una pestaña válida", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=finanzas"), onlyActive).tab).toBe("finanzas");
  });

  it("pestaña inválida o ausente ⇒ sin pestaña (el workspace cae en Resumen)", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=xyz"), allVisible).tab).toBeUndefined();
    expect(resolveWorkspaceUrl(new URLSearchParams(""), allVisible).tab).toBeUndefined();
  });

  it("pestaña oculta por el registro ⇒ sin pestaña", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=proyectos"), onlyActive).tab).toBeUndefined();
  });

  it("deep-links legacy siguen migrando (propuesta → comercial/propuestas)", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=propuesta"), allVisible)).toEqual({ tab: "comercial", sub: "propuestas" });
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=documentos"), allVisible)).toEqual({ tab: "comercial", sub: "facturacion" });
  });

  it("?sub= válido se respeta; inválido se ignora", () => {
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=comercial&sub=contratos"), allVisible).sub).toBe("contratos");
    expect(resolveWorkspaceUrl(new URLSearchParams("tab=comercial&sub=zzz"), allVisible).sub).toBeUndefined();
  });
});

describe("workspaceTabSearch (cambio de pestaña → URL)", () => {
  it("pone la pestaña y descarta nueva (la intención no viaja a otra pestaña)", () => {
    expect(workspaceTabSearch(new URLSearchParams("tab=cotizaciones&nueva=1"), "resumen")).toBe("?tab=resumen");
  });

  it("conserva parámetros ajenos y descarta sub fuera de Comercial", () => {
    expect(workspaceTabSearch(new URLSearchParams("tab=comercial&sub=contratos&x=1"), "cotizaciones")).toBe("?tab=cotizaciones&x=1");
  });
});

/** WO-2026-00526: clic de pestaña → URL; la URL resultante se vuelve a leer igual (refresh). */
describe("clic de pestaña → URL → refresh (WO-2026-00526)", () => {
  const tabs = ["resumen", "cotizaciones", "finanzas"] as const;

  it.each(tabs)("?tab=%s sobrevive al viaje de ida y vuelta por la URL", (tab) => {
    const search = workspaceTabSearch(new URLSearchParams(""), tab);
    expect(search).toBe(`?tab=${tab}`);
    expect(resolveWorkspaceUrl(new URLSearchParams(search), onlyActive).tab).toBe(tab);
  });

  it("salir de Cotizaciones con nueva=1 y volver NO deja nueva=1 (el formulario no se reabre)", () => {
    const toFinanzas = workspaceTabSearch(new URLSearchParams("tab=cotizaciones&nueva=1"), "finanzas");
    expect(toFinanzas).toBe("?tab=finanzas");
    const back = workspaceTabSearch(new URLSearchParams(toFinanzas), "cotizaciones");
    expect(back).toBe("?tab=cotizaciones");
    expect(new URLSearchParams(back).get("nueva")).toBeNull();
  });

  it("conserva otros parámetros ajenos al cambiar de pestaña (y sub en Comercial)", () => {
    expect(workspaceTabSearch(new URLSearchParams("utm=mail&tab=resumen"), "finanzas")).toBe("?tab=finanzas&utm=mail");
    expect(workspaceTabSearch(new URLSearchParams("tab=comercial&sub=contratos"), "comercial")).toBe("?tab=comercial&sub=contratos");
  });
});

/** WO-2026-00526: href completo que la página pasa a router.replace. */
describe("workspaceTabHref", () => {
  it("une pathname y query de la pestaña", () => {
    expect(workspaceTabHref("/clientes/abc", new URLSearchParams("tab=cotizaciones&nueva=1"), "finanzas")).toBe("/clientes/abc?tab=finanzas");
  });

  it("sin searchParams (null) también funciona", () => {
    expect(workspaceTabHref("/clientes/abc", null, "cotizaciones")).toBe("/clientes/abc?tab=cotizaciones");
  });
});

/**
 * WO-2026-00526 (medido en navegador): al cambiar de pestaña desde el
 * formulario nuevo, CotizacionesTab se desmonta ANTES de que router.replace
 * actualice la URL, así que su limpieza no consumía la intención. El cambio
 * de pestaña la consume explícitamente cuando la URL trae nueva=1.
 */
describe("consumeNuevaOnTabChange", () => {
  function memoryStorage(): Storage {
    const m = new Map<string, string>();
    return {
      get length() { return m.size; },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => void m.delete(k),
      setItem: (k, v) => void m.set(k, v),
    };
  }

  it("con nueva=1 consume la intención del cliente", () => {
    const storage = memoryStorage();
    markNuevaIntent("abc", storage);
    consumeNuevaOnTabChange(new URLSearchParams("tab=cotizaciones&nueva=1"), "abc", storage);
    expect(hasNuevaIntent("abc", storage)).toBe(false);
  });

  it("sin nueva=1 no toca la intención (p. ej. otra pestaña del navegador acaba de pulsar el botón)", () => {
    const storage = memoryStorage();
    markNuevaIntent("abc", storage);
    consumeNuevaOnTabChange(new URLSearchParams("tab=cotizaciones"), "abc", storage);
    expect(hasNuevaIntent("abc", storage)).toBe(true);
  });

  it("sin storage o sin searchParams no truena", () => {
    expect(() => consumeNuevaOnTabChange(null, "abc", null)).not.toThrow();
  });
});
