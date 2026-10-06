import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// Cliente Drizzle real sin conexión: los builders solo se inspeccionan con
// .toSQL(), nunca se ejecutan.
vi.mock("@/lib/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const postgres = (await import("postgres")).default;
  const schema = await import("@/lib/db/schema");
  return { db: drizzle(postgres("postgres://nadie@127.0.0.1:1/nada", { max: 1 }), { schema }) };
});
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot: vi.fn() }));

import { buildSnapshot, deriveDashboard, settle, type SnapshotLoaders } from "./dashboard";
import {
  buildActivityQuery,
  buildBillingQuery,
  buildClientsQuery,
  buildLeadsQuery,
  buildNotificationsQuery,
  buildPaymentsQuery,
  buildQuotesQuery,
  buildSalesQuery,
} from "./queries/snapshot-queries";
import { NOW, fullSnapshot } from "./__tests__/fixtures";

const OWNER = "11111111-1111-1111-1111-111111111111";

describe("scoping por dueño (ADR-0036: nunca datos de otro owner)", () => {
  const cases: [string, { sql: string; params: unknown[] }, RegExp][] = [
    ["clients", buildClientsQuery(OWNER).toSQL(), /"clients"\."owner_id" = \$1/],
    ["quotes", buildQuotesQuery(OWNER, NOW).toSQL(), /"clients"\."owner_id" = \$1/],
    ["sales", buildSalesQuery(OWNER, NOW).toSQL(), /"clients"\."owner_id" = \$1/],
    ["billing", buildBillingQuery(OWNER, NOW).toSQL(), /"billing_items"\."owner_id" = \$1/],
    ["payments", buildPaymentsQuery(OWNER, NOW).toSQL(), /"billing_items"\."owner_id" = \$1/],
    ["activity", buildActivityQuery(OWNER, NOW).toSQL(), /"client_activity"\."owner_id" = \$1/],
    ["notifications", buildNotificationsQuery(OWNER).toSQL(), /"notifications"\."user_id" = \$1/],
  ];
  for (const [name, q, re] of cases) {
    it(`${name} filtra por el owner de la sesión`, () => {
      expect(q.sql).toMatch(re);
      expect(q.params[0]).toBe(OWNER);
    });
  }

  it("quotes y sales se acotan por JOIN a clients", () => {
    expect(buildQuotesQuery(OWNER, NOW).toSQL().sql).toMatch(/inner join "clients"/i);
    expect(buildSalesQuery(OWNER, NOW).toSQL().sql).toMatch(/inner join "clients"/i);
  });

  it("leads es el feed global (sin owner_id), igual que /clientes/leads", () => {
    expect(buildLeadsQuery(NOW).toSQL().sql).not.toMatch(/owner_id/);
  });
});

describe("aislamiento de fallas", () => {
  it("settle convierte una excepción en ok:false sin propagarla", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(settle(async () => { throw new Error("boom"); })).resolves.toEqual({ ok: false, error: "load_failed" });
    await expect(settle(async () => 3)).resolves.toEqual({ ok: true, data: 3 });
  });

  it("un loader caído solo apaga los widgets que dependen de él", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const base = fullSnapshot();
    const unwrap = <T,>(r: { ok: boolean; data?: T }) => async () => (r as { data: T }).data;
    const loaders: SnapshotLoaders = {
      clients: unwrap(base.clients),
      quotes: unwrap(base.quotes),
      sales: unwrap(base.sales),
      billing: async () => { throw new Error("billing caído"); },
      payments: unwrap(base.payments),
      leads: unwrap(base.leads),
      activity: unwrap(base.activity),
      notifications: unwrap(base.notifications),
      conversations: async () => { throw new Error("pixelbot caído"); },
    };
    const snap = await buildSnapshot(NOW, loaders);
    expect(snap.billing.ok).toBe(false);
    expect(snap.conversations.status).toBe("unavailable");
    const dash = deriveDashboard(snap, { vista: "hoy", actividad: "todas", greetingName: "Miguel" });
    expect(dash.cobros.ok).toBe(false);
    expect(dash.prioridades.ok).toBe(false);
    expect(dash.actividad.ok).toBe(true);
    expect(dash.kpis.ok).toBe(true);
    if (dash.kpis.ok) {
      expect(dash.kpis.data.find((k) => k.id === "cobros")?.valueText).toBeNull();
      expect(dash.kpis.data.find((k) => k.id === "leads")?.valueText).toBe("1");
    }
    expect(dash.dateLabel).toBe("Martes, 6 de octubre de 2026");
  });
});
