import { describe, expect, it } from "vitest";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { deriveKpis } from "@/lib/hoy/derive/kpis";
import { emptySnapshot } from "@/lib/hoy/__tests__/fixtures";
import { withCommercialFollowups } from "./home-kpis";

function source() {
  return {
    now: "2026-10-13T04:00:00Z",
    opportunities: [] as CommercialSnapshot["opportunities"],
    contacts: [] as CommercialSnapshot["contacts"],
    quotes: [] as CommercialSnapshot["quotes"],
  };
}
function cards() {
  const value = deriveKpis(emptySnapshot());
  if (!value.ok) throw Error("fixture");
  return value.data;
}
function opportunity(due: string, stage = "conversacion") {
  return {
    id: "sale",
    clientId: "client",
    quoteId: null,
    stage,
    nextActionDue: due,
  } as CommercialSnapshot["opportunities"][number];
}
describe("Seguimientos del Centro incluidos en Inicio", () => {
  it("incluye pendientes de hoy y vencidos, excluye futuras y ventas cerradas", () => {
    const data = source();
    data.opportunities = [
      opportunity("2026-10-12"),
      opportunity("2026-10-11"),
      opportunity("2026-10-13"),
      opportunity("2026-10-12", "ganado"),
    ];
    const value = withCommercialFollowups(cards(), data).find(
      (c) => c.id === "seguimientos",
    )!;
    expect(value.valueText).toBe("2");
    expect(value.series.at(-1)).toBe(1);
    expect(value.series.at(-2)).toBe(1);
  });
  it("no cuenta dos veces el paso existente del mismo cliente", () => {
    const data = source();
    data.contacts = [
      {
        id: "client",
        nextAction: { label: "Responder", dueAt: "2026-10-12" },
      } as CommercialSnapshot["contacts"][number],
    ];
    data.opportunities = [opportunity("2026-10-12")];
    const original = cards();
    original.find((c) => c.id === "seguimientos")!.valueText = "1";
    expect(
      withCommercialFollowups(original, data).find(
        (c) => c.id === "seguimientos",
      )!.valueText,
    ).toBe("1");
  });
  it("no cuenta dos veces el seguimiento de la cotización vinculada", () => {
    const data = source();
    const row = opportunity("2026-10-12");
    row.quoteId = "quote";
    data.opportunities = [row];
    data.quotes = [
      {
        id: "quote",
        status: "enviada",
        nextFollowUpAt: "2026-10-12",
      } as CommercialSnapshot["quotes"][number],
    ];
    const original = cards();
    original.find((c) => c.id === "seguimientos")!.valueText = "1";
    expect(
      withCommercialFollowups(original, data).find(
        (c) => c.id === "seguimientos",
      )!.valueText,
    ).toBe("1");
  });
  it("conserva los otros indicadores y no inventa valor cuando falla su fuente", () => {
    const data = source();
    data.opportunities = [opportunity("2026-10-12")];
    const original = cards();
    original.find((c) => c.id === "seguimientos")!.valueText = null;
    const result = withCommercialFollowups(original, data);
    expect(result.find((c) => c.id === "seguimientos")!.valueText).toBeNull();
    expect(result.filter((c) => c.id !== "seguimientos")).toEqual(
      original.filter((c) => c.id !== "seguimientos"),
    );
  });
});
