import { describe, expect, it } from "vitest";
import type { HoySnapshot, SnapQuote } from "@/lib/hoy/snapshot";
import { NOW, client, fullSnapshot } from "../__tests__/fixtures";
import { deriveActivity } from "./activity";

/**
 * WO-2026-00519: la actividad de cotizaciones sale SOLO de timestamps reales
 * de `quotes` (`sent_at`, `accepted_at`, `rejected_at`). Sin timestamp ⇒ sin
 * evento; importe solo cuando hay un total real (> 0, moneda conocida).
 */
const ok = <T,>(data: T) => ({ ok: true as const, data });

function quote(over: Partial<SnapQuote> & { id: string }): SnapQuote {
  return {
    clientPgId: "c-dalk",
    folio: "COT-2026-0100",
    title: "Tienda en línea",
    status: "borrador",
    totalCents: 0,
    currency: "MXN",
    sentAt: null,
    acceptedAt: null,
    rejectedAt: null,
    nextFollowUpAt: null,
    ...over,
  };
}

function snapWith(quotes: SnapQuote[]): HoySnapshot {
  return {
    ...fullSnapshot(),
    clients: ok([client({ pgId: "c-dalk", name: "DALK", publicId: "fs-dalk" })]),
    quotes: ok(quotes),
    payments: ok([]),
    leads: ok([]),
    activity: ok([]),
    conversations: { status: "unavailable", items: [] },
  };
}

const rowsOf = (snap: HoySnapshot, filter: Parameters<typeof deriveActivity>[1] = "cotizaciones") => {
  const r = deriveActivity(snap, filter);
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

describe("deriveActivity · cotizaciones reales", () => {
  it("enviada y aceptada: un evento por timestamp, con importe, fecha real y enlace a la pestaña", () => {
    const rows = rowsOf(
      snapWith([
        quote({ id: "q1", status: "aceptada", totalCents: 4_800_000, sentAt: "2026-10-01T17:00:00.000Z", acceptedAt: "2026-10-04T18:00:00.000Z" }),
      ]),
    );
    expect(rows.map((r) => r.id)).toEqual(["q:q1:cotizacion_aceptada", "q:q1:cotizacion_enviada"]);
    expect(rows[0]).toMatchObject({
      kind: "cotizacion",
      title: "Cotización aceptada por DALK",
      at: "2026-10-04T18:00:00.000Z",
      href: "/clientes/fs-dalk?tab=cotizaciones",
    });
    expect(rows[0].subtitle).toBe("COT-2026-0100 · Tienda en línea");
    expect(rows[0].amount).toBe("$48,000.00 MXN");
    expect(rows[1]).toMatchObject({ title: "Cotización enviada a DALK", at: "2026-10-01T17:00:00.000Z" });
  });

  it("rechazada con rejected_at ⇒ evento de rechazo (en USD, con su código)", () => {
    const rows = rowsOf(
      snapWith([quote({ id: "q2", status: "rechazada", totalCents: 150_050, currency: "USD", rejectedAt: "2026-10-05T16:00:00.000Z" })]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: "q:q2:cotizacion_rechazada", title: "Cotización rechazada por DALK", at: "2026-10-05T16:00:00.000Z" });
    expect(rows[0].amount).toContain("USD");
    expect(rows[0].amount).toContain("1,500.50");
  });

  it("sin timestamp no hay evento: no se reconstruye historia por el estado", () => {
    const rows = rowsOf(
      snapWith([
        quote({ id: "q3", status: "rechazada", totalCents: 100_000 }), // rechazada sin rejected_at
        quote({ id: "q4", status: "aceptada", totalCents: 100_000 }), // aceptada sin accepted_at
        quote({ id: "q5", status: "enviada", totalCents: 100_000 }), // enviada sin sent_at
        quote({ id: "q6", status: "borrador" }),
      ]),
    );
    expect(rows).toEqual([]);
  });

  it("importe ausente o no real ⇒ sin importe (nunca «$0», «NaN» ni «undefined»)", () => {
    const rows = rowsOf(
      snapWith([
        quote({ id: "z", sentAt: "2026-10-05T10:00:00.000Z", totalCents: 0 }),
        quote({ id: "n", sentAt: "2026-10-05T11:00:00.000Z", totalCents: Number.NaN }),
        quote({ id: "c", sentAt: "2026-10-05T12:00:00.000Z", totalCents: 50_000, currency: "XYZ" }),
        quote({ id: "t", sentAt: "2026-10-05T13:00:00.000Z", totalCents: 0, title: "  " }),
      ]),
    );
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.amount ?? null).toBeNull();
      expect(r.subtitle).not.toMatch(/\$0|NaN|undefined|null/);
    }
    expect(rows.find((r) => r.id === "q:z:cotizacion_enviada")?.subtitle).toBe("COT-2026-0100 · Tienda en línea");
    expect(rows.find((r) => r.id === "q:t:cotizacion_enviada")?.subtitle).toBe("COT-2026-0100");
  });

  it("timestamp inválido ⇒ se descarta", () => {
    expect(rowsOf(snapWith([quote({ id: "bad", sentAt: "no-es-fecha", totalCents: 1000 })]))).toEqual([]);
  });

  it("cliente desconocido ⇒ texto honesto y enlace a /clientes", () => {
    const rows = rowsOf(snapWith([quote({ id: "q7", clientPgId: "c-otro", sentAt: "2026-10-05T10:00:00.000Z" })]));
    expect(rows[0]).toMatchObject({ title: "Cotización enviada a un cliente", href: "/clientes" });
  });

  it("ordena de la más reciente a la más vieja y limita a 12", () => {
    const qs = Array.from({ length: 15 }, (_, i) =>
      quote({ id: `q${i}`, sentAt: new Date(NOW.getTime() - (i + 1) * 3_600_000).toISOString(), totalCents: 10_000 }),
    );
    const rows = rowsOf(snapWith(qs.reverse()));
    expect(rows).toHaveLength(12);
    expect(rows[0].id).toBe("q:q0:cotizacion_enviada");
    const times = rows.map((r) => Date.parse(r.at));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("el filtro «cotizaciones» deja solo eventos de cotización; «todas» los mezcla con el resto", () => {
    const base = fullSnapshot();
    const all = rowsOf(base, "todas");
    const onlyQuotes = rowsOf(base, "cotizaciones");
    expect(onlyQuotes.length).toBeGreaterThan(0);
    expect(onlyQuotes.every((r) => r.kind === "cotizacion")).toBe(true);
    expect(all.some((r) => r.kind !== "cotizacion")).toBe(true);
  });
});
