import { describe, expect, it } from "vitest";
import { deriveChecklist } from "./checklist-items";
import { deriveCobros } from "./cobros";
import { deriveAlerts } from "./alert-rules";
import { derivePipeline } from "./pipeline-stages";
import { deriveActivity } from "./activity";
import { emptySnapshot, fullSnapshot, NOW } from "../__tests__/fixtures";

function data<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(r.error);
  return r.data;
}

describe("deriveChecklist (derivado, solo lectura)", () => {
  it("ítems del día con evidencia de «hecho»", () => {
    const items = data(deriveChecklist(fullSnapshot()));
    const labels = items.map((i) => `${i.done ? "✓" : "·"} ${i.label}`);
    expect(labels).toEqual([
      // con hora, ascendente; luego «Todo el día»
      "· Dar seguimiento a PixelState",
      "✓ Enviar propuesta actualizada — Velank Boutique",
      "· Confirmar pago con DALK",
      "· Contactar lead Clínica Vital",
    ]);
    expect(items[2].at).toBeNull();
  });

  it("vacío honesto", () => {
    expect(data(deriveChecklist(emptySnapshot()))).toEqual([]);
  });
});

describe("deriveCobros", () => {
  it("pendientes por vencimiento con chip de urgencia", () => {
    const rows = data(deriveCobros(fullSnapshot()));
    expect(rows.map((r) => [r.clientName, r.amountText, r.chip.label, r.chip.tone])).toEqual([
      ["PixelState", "$1,200 MXN", "Vencido hace 5 días", "red"],
      ["DALK", "$156,000 MXN", "Vence hoy", "red"],
      ["Smile More Dental", "$8,000 MXN", "Vence en 2 días", "amber"],
    ]);
  });
});

describe("deriveAlerts", () => {
  it("cotización abierta, lead que pidió contacto y cobro vencido; sin «bot detectó intención»", () => {
    const { rows, total } = data(deriveAlerts(fullSnapshot()));
    expect(rows.map((a) => a.kind)).toEqual(["cobro_vencido", "cotizacion_abierta", "lead_contacto"]);
    expect(total).toBe(3);
    expect(rows.find((a) => a.kind === "cotizacion_abierta")?.description).toContain("8 días");
    for (const a of rows) expect(a.description).not.toMatch(/bot detect/i);
  });

  it("cliente sin respuesta: cotización enviada hace 3-6 días", () => {
    const snap = fullSnapshot();
    if (snap.quotes.ok) snap.quotes.data[0].sentAt = "2026-10-02T17:00:00Z";
    const { rows } = data(deriveAlerts(snap));
    expect(rows.some((a) => a.kind === "sin_respuesta" && a.description.includes("Smile More Dental"))).toBe(true);
  });
});

describe("derivePipeline (derivado, sin migración)", () => {
  it("siete etapas con el mapeo documentado", () => {
    const { columns, total } = data(derivePipeline(fullSnapshot()));
    expect(columns.map((c) => [c.label, c.count])).toEqual([
      ["Nuevo lead", 2],
      ["Contactado", 1],
      ["En seguimiento", 2],
      ["Cotización enviada", 1],
      ["Negociación", 1],
      ["Pago pendiente", 3],
      ["Cerrado", 1],
    ]);
    expect(total).toBe(11);
    expect(columns[3].cards[0]).toMatchObject({ name: "Smile More Dental", amountText: "$48,000 MXN" });
  });

  it("máximo 3 tarjetas y «+N más»", () => {
    const snap = fullSnapshot();
    if (snap.leads.ok) {
      for (let i = 0; i < 5; i++) {
        snap.leads.data.push({ id: `x${i}`, name: `Lead ${i}`, status: "new", createdAt: NOW.toISOString(), wantsContact: false, wantsContactAt: null, clientPgId: null });
      }
    }
    const col = data(derivePipeline(snap)).columns[0];
    expect(col.cards).toHaveLength(3);
    expect(col.more).toBe(4);
  });
});

describe("deriveActivity", () => {
  it("une fuentes y ordena de la más reciente a la más vieja", () => {
    const rows = data(deriveActivity(fullSnapshot(), "todas"));
    expect(rows[0]).toMatchObject({ kind: "whatsapp", title: "Nuevo mensaje de Smile More Dental" });
    const times = rows.map((r) => Date.parse(r.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("filtra por tipo", () => {
    const rows = data(deriveActivity(fullSnapshot(), "cobros"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === "cobro")).toBe(true);
    expect(rows[0].title).toBe("Pago recibido de DALK");
  });
});
