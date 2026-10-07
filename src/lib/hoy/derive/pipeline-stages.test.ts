import { describe, expect, it } from "vitest";
import type { HoySnapshot, SnapQuote, SnapSale } from "@/lib/hoy/snapshot";
import { emptySnapshot, client } from "../__tests__/fixtures";
import { derivePipeline } from "./pipeline-stages";

/**
 * WO-2026-00519 (polish): una tarjeta del pipeline solo muestra importe si es
 * real (> 0 y moneda válida). Una cotización sin conceptos no se presenta como
 * «$0 MXN»: la tarjeta queda solo con el nombre.
 */
const ok = <T,>(data: T) => ({ ok: true as const, data });

function quote(over: Partial<SnapQuote> & { id: string }): SnapQuote {
  return {
    clientPgId: "c-ps",
    folio: "COT-1",
    title: "X",
    status: "enviada",
    totalCents: 0,
    currency: "MXN",
    sentAt: "2026-10-01T17:00:00Z",
    acceptedAt: null,
    rejectedAt: null,
    nextFollowUpAt: "2026-10-20T17:00:00Z",
    ...over,
  };
}

function snap(quotes: SnapQuote[], sales: SnapSale[] = []): HoySnapshot {
  return { ...emptySnapshot(), clients: ok([client({ pgId: "c-ps", name: "PixelState" })]), quotes: ok(quotes), sales: ok(sales) };
}

function cards(s: HoySnapshot) {
  const r = derivePipeline(s);
  if (!r.ok) throw new Error(r.error);
  return r.data.columns.flatMap((c) => c.cards);
}

describe("derivePipeline · importe solo si es real", () => {
  it("con importe real ⇒ «$48,000 MXN»", () => {
    expect(cards(snap([quote({ id: "a", totalCents: 4_800_000 })]))[0].amountText).toBe("$48,000 MXN");
  });

  it("sin conceptos / total 0 ⇒ sin importe (nunca «$0»)", () => {
    const [card] = cards(snap([quote({ id: "b", totalCents: 0 })]));
    expect(card.name).toBe("PixelState");
    expect(card.amountText).toBeNull();
  });

  it("total no numérico ⇒ sin importe", () => {
    expect(cards(snap([quote({ id: "c", totalCents: Number.NaN })]))[0].amountText).toBeNull();
  });

  it("moneda inválida ⇒ sin importe", () => {
    expect(cards(snap([quote({ id: "d", totalCents: 50_000, currency: "XYZ" })]))[0].amountText).toBeNull();
  });

  it("también en Negociación (seguimiento vencido), el caso demo COT-0107", () => {
    const all = derivePipeline(snap([quote({ id: "e", totalCents: 0, nextFollowUpAt: "2026-10-01T17:00:00Z" })]));
    if (!all.ok) throw new Error(all.error);
    const neg = all.data.columns.find((c) => c.id === "negociacion")!;
    expect(neg.cards).toHaveLength(1);
    expect(neg.cards[0].amountText).toBeNull();
  });

  it("venta pendiente de anticipo con total 0 ⇒ sin importe", () => {
    const sale: SnapSale = { id: "s", clientPgId: "c-ps", status: "pendiente_anticipo", title: "Plan", acceptedAt: "2026-10-05T17:00:00Z", totalCents: 0, currency: "MXN" };
    expect(cards(snap([], [sale]))[0].amountText).toBeNull();
  });

  it("cobro pendiente con monto 0 ⇒ sin importe; con monto real ⇒ importe", () => {
    const s = snap([]);
    s.billing = ok([
      { id: "b0", clientPgId: "c-ps", concept: "X", amount: 0, currency: "MXN", status: "pendiente", dueDate: "2026-10-08" },
      { id: "b1", clientPgId: "c-ps", concept: "Y", amount: 6200, currency: "MXN", status: "pendiente", dueDate: "2026-10-08" },
    ]);
    const byId = Object.fromEntries(cards(s).map((c) => [c.id, c.amountText]));
    expect(byId["b:b0"]).toBeNull();
    expect(byId["b:b1"]).toBe("$6,200 MXN");
  });
});
