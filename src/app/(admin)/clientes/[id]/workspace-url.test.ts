import { describe, expect, it } from "vitest";
import type { ClientWorkspaceSection } from "@/lib/modules/client-workspace";
import { resolveWorkspaceUrl, workspaceTabSearch } from "./workspace-url";

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
