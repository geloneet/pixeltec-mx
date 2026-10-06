import { describe, expect, it } from "vitest";
import { derivePriorities } from "./priority-order";
import { emptySnapshot, fullSnapshot } from "../__tests__/fixtures";

describe("derivePriorities", () => {
  it("ordena: pago vencido > seguimiento vencido > hoy > cotización enviada", () => {
    const r = derivePriorities(fullSnapshot(), "hoy");
    if (!r.ok) throw new Error();
    expect(r.data.rows.map((p) => p.clientName)).toEqual([
      "PixelState", // cobro vencido 1 oct
      "DALK", // cobro vence hoy
      "Velank Boutique", // próxima acción hoy
      "Smile More Dental", // cotización enviada, follow-up futuro
    ]);
    expect(r.data.total).toBe(4);
  });

  it("una fila por cliente con su motivo más urgente", () => {
    const r = derivePriorities(fullSnapshot(), "hoy");
    if (!r.ok) throw new Error();
    const pixel = r.data.rows.find((p) => p.clientName === "PixelState")!;
    expect(pixel.status).toBe("pago_vencido");
    expect(pixel.cta).toEqual({ label: "Registrar pago", href: "/cobros" });
  });

  it("WhatsApp real cuando hay conversación vinculada; nunca preview inventado", () => {
    const r = derivePriorities(fullSnapshot(), "hoy");
    if (!r.ok) throw new Error();
    const smile = r.data.rows.find((p) => p.clientName === "Smile More Dental")!;
    expect(smile.channel).toBe("whatsapp");
    expect(smile.message).toBe("Hola, ¿me compartes la propuesta?");
    expect(smile.cta.label).toBe("Ver conversación");
    expect(smile.amountText).toBe("$48,000 MXN");
    const velank = r.data.rows.find((p) => p.clientName === "Velank Boutique")!;
    expect(velank.channel).toBeNull();
    expect(velank.message).toBeNull();
    expect(velank.nextAction?.label).toBe("Enviar propuesta actualizada");
  });

  it("sin conversación: sin chip de canal (quotes no guarda el canal), mensaje factual de la cotización", () => {
    const snap = fullSnapshot();
    snap.conversations = { status: "unavailable", items: [] };
    const r = derivePriorities(snap, "hoy");
    if (!r.ok) throw new Error();
    const smile = r.data.rows.find((p) => p.clientName === "Smile More Dental")!;
    expect(smile.channel).toBeNull();
    expect(smile.message).toContain("COT-2026-0001");
    expect(smile.cta.label).toBe("Dar seguimiento");
    expect(smile.cta.href).toBe("/clientes/c-smile?tab=cotizaciones");
  });

  it("vistas filtran: cobros solo pagos, cotizaciones solo cotizaciones, activos solo activos", () => {
    const snap = fullSnapshot();
    const names = (v: Parameters<typeof derivePriorities>[1]) => {
      const r = derivePriorities(snap, v);
      if (!r.ok) throw new Error();
      return r.data.rows.map((p) => p.clientName);
    };
    expect(names("cobros")).toEqual(["PixelState", "DALK", "Smile More Dental"]);
    expect(names("cotizaciones")).toEqual(["PixelState", "Smile More Dental"]);
    expect(names("clientes-activos")).toEqual(["DALK", "Smile More Dental"]);
    expect(names("pendientes")).toEqual(["PixelState", "DALK", "Velank Boutique"]);
  });

  it("BD vacía ⇒ sin filas", () => {
    const r = derivePriorities(emptySnapshot(), "hoy");
    expect(r).toEqual({ ok: true, data: { rows: [], total: 0 } });
  });

  it("si clientes falla, el widget falla", () => {
    const snap = fullSnapshot();
    snap.clients = { ok: false, error: "db" };
    expect(derivePriorities(snap, "hoy").ok).toBe(false);
  });
});
