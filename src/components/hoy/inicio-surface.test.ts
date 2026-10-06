import { describe, expect, it } from "vitest";
import { INICIO_WIDGETS, getVisibleInicioWidgets, isInicioWidgetVisible } from "./inicio-surface";
import { HOY_VIEWS, DEFAULT_HOY_VIEW, parseHoyView } from "./hoy-views";
import { getModule, isModuleVisible } from "@/lib/modules/registry";

/**
 * WO-2026-00515: cada widget de Inicio pertenece a un módulo registrado y solo
 * se renderiza si ese módulo es visible (ADR-0054 propuesta del repo, registro
 * central). Las vistas del topbar son vistas de /hoy, no rutas nuevas.
 */
describe("superficie de Inicio (Centro Comercial)", () => {
  it("todos los widgets del mockup están declarados", () => {
    expect(Object.keys(INICIO_WIDGETS).sort()).toEqual(
      [
        "kpiLeads",
        "kpiSeguimientos",
        "kpiCotizaciones",
        "kpiCobros",
        "kpiCobrado",
        "prioridades",
        "checklist",
        "cobros",
        "alertas",
        "pipeline",
        "actividad",
        "conversaciones",
      ].sort()
    );
  });

  it("cada widget pertenece a un módulo registrado", () => {
    for (const [widget, moduleId] of Object.entries(INICIO_WIDGETS)) {
      expect(() => getModule(moduleId), widget).not.toThrow();
    }
  });

  it("la visibilidad de un widget es la de su módulo", () => {
    for (const [widget, moduleId] of Object.entries(INICIO_WIDGETS)) {
      expect(isInicioWidgetVisible(widget as keyof typeof INICIO_WIDGETS), widget).toBe(
        isModuleVisible(moduleId)
      );
    }
    expect(getVisibleInicioWidgets().length).toBeGreaterThan(0);
  });
});

describe("vistas del topbar de /hoy", () => {
  it("son exactamente las del mockup, en orden", () => {
    expect(HOY_VIEWS.map((v) => v.label)).toEqual([
      "Hoy",
      "Pendientes",
      "Cotizaciones",
      "Cobros",
      "Clientes activos",
    ]);
    for (const v of HOY_VIEWS) expect(v.module).toBe("inicio");
  });

  it("parsea ?vista= con default seguro", () => {
    expect(DEFAULT_HOY_VIEW).toBe("hoy");
    expect(parseHoyView(undefined)).toBe("hoy");
    expect(parseHoyView("cobros")).toBe("cobros");
    expect(parseHoyView("clientes-activos")).toBe("clientes-activos");
    expect(parseHoyView("<script>")).toBe("hoy");
    expect(parseHoyView(["pendientes", "x"])).toBe("pendientes");
  });

  it("cada vista enlaza a /hoy con su query", () => {
    expect(HOY_VIEWS[0].href).toBe("/hoy");
    expect(HOY_VIEWS.find((v) => v.id === "cobros")?.href).toBe("/hoy?vista=cobros");
  });
});
