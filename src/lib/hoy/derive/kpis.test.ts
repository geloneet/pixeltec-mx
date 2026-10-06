import { describe, expect, it } from "vitest";
import { deriveKpis } from "./kpis";
import { emptySnapshot, fullSnapshot } from "../__tests__/fixtures";

function byId(result: ReturnType<typeof deriveKpis>) {
  if (!result.ok) throw new Error("esperaba ok");
  return Object.fromEntries(result.data.map((k) => [k.id, k]));
}

describe("deriveKpis", () => {
  it("los cinco KPI del mockup, en orden", () => {
    const r = deriveKpis(fullSnapshot());
    expect(r.ok && r.data.map((k) => k.label)).toEqual([
      "Leads nuevos",
      "Seguimientos hoy",
      "Cotizaciones pendientes",
      "Cobros por vencer",
      "Cobrado este mes",
    ]);
  });

  it("leads nuevos de hoy con delta vs. ayer y serie de 7 días", () => {
    const k = byId(deriveKpis(fullSnapshot())).leads;
    expect(k.valueText).toBe("1");
    expect(k.delta).toMatchObject({ pct: 0, direction: "flat", comparison: "vs. ayer" });
    expect(k.series).toHaveLength(7);
    expect(k.series.at(-1)).toBe(1);
  });

  it("seguimientos: follow-up vencido + próxima acción de hoy", () => {
    const k = byId(deriveKpis(fullSnapshot())).seguimientos;
    expect(k.valueText).toBe("2");
  });

  it("cotizaciones pendientes cuenta enviadas y listas", () => {
    expect(byId(deriveKpis(fullSnapshot())).cotizaciones.valueText).toBe("3");
  });

  it("cobros por vencer: pendientes con vencimiento en los próximos 7 días", () => {
    const k = byId(deriveKpis(fullSnapshot())).cobros;
    expect(k.valueText).toBe("2");
    expect(k.delta?.comparison).toBe("vs. semana pasada");
  });

  it("cobrado este mes suma pagos del mes en CDMX", () => {
    const k = byId(deriveKpis(fullSnapshot())).cobrado;
    expect(k.valueText).toBe("$10,500");
    expect(k.chart).toBe("bars");
    // mes anterior al mismo día (1-6 sep) no tiene pagos ⇒ sin base
    expect(k.delta).toMatchObject({ pct: null, direction: "up" });
  });

  it("BD vacía: ceros reales en conteos, cobrado sin dato no es «$0» inventado", () => {
    const k = byId(deriveKpis(emptySnapshot()));
    expect(k.leads.valueText).toBe("0");
    expect(k.cobrado.valueText).toBe("$0");
    for (const card of Object.values(k)) {
      expect(card.valueText).not.toMatch(/NaN|undefined/);
    }
  });

  it("si una fuente falla, solo su KPI queda sin dato", () => {
    const snap = fullSnapshot();
    snap.payments = { ok: false, error: "db" };
    const k = byId(deriveKpis(snap));
    expect(k.cobrado.valueText).toBeNull();
    expect(k.cobrado.delta).toBeNull();
    expect(k.leads.valueText).toBe("1");
  });
});
