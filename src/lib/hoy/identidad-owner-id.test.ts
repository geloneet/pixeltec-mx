import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Gate B1 de la remediación de identidad — reescrito para WO-2026-00515.
 *
 * Garantía que se conserva: /hoy resuelve SIEMPRE por `users.id`
 * (session.user.id) y nunca traduce por `users.firebase_uid`. Una cuenta sin
 * alias heredado ve exactamente lo mismo que una con alias.
 *
 * Cambio de contrato: /hoy ya no usa `getFullCrmData` ni `getTodayData`; la
 * página resuelve la sesión una vez (`requireUserSession`) y pasa `ownerId` a
 * los loaders de `src/lib/hoy/queries`.
 */

const OWNER_A = "aaaaaaaa-1111-4aaa-8aaa-aaaaaaaaaaaa";
const OWNER_B = "bbbbbbbb-2222-4bbb-8bbb-bbbbbbbbbbbb";
const LEGACY_UID = "jO09XxAbCdEfGhIjKlMnOpQrStUv";

vi.mock("server-only", () => ({}));

const sessionMock = vi.fn();
vi.mock("@/lib/auth/config", () => ({ auth: () => sessionMock() }));
vi.mock("@/lib/auth/authority", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/authority")>()),
  resolveAuthority: async (userId: string) => ({ ok: true as const, userId, role: "admin" as const, isAdmin: true }),
}));

// Cada loader registra con qué identidad se le llamó.
const calls: Record<string, unknown[]> = {};
const record = (name: string) => async (...args: unknown[]) => {
  calls[name] = args;
  return [];
};
vi.mock("./queries/snapshot-queries", () => ({
  loadClients: record("clients"),
  loadQuotes: record("quotes"),
  loadSales: record("sales"),
  loadBilling: record("billing"),
  loadPayments: record("payments"),
  loadLeads: record("leads"),
  loadActivity: record("activity"),
  loadNotifications: record("notifications"),
  loadUserFirstName: async (id: string) => {
    calls.userName = [id];
    return "Miguel";
  },
}));
vi.mock("./queries/conversaciones", () => ({
  loadConversations: async () => ({ status: "not_allowed", items: [] }),
}));

const sessionModule = await import("@/lib/auth/session");
const { getHoyDashboard } = await import("./dashboard");

const sesionConPuente = (id: string) => ({ user: { id, email: "a@x.mx", role: "admin", firebaseUid: LEGACY_UID } });
const sesionSinPuente = (id: string) => ({ user: { id, email: "a@x.mx", role: "admin", firebaseUid: null } });

const OWNER_SCOPED = ["clients", "quotes", "sales", "billing", "payments", "activity", "notifications", "userName"];

beforeEach(() => {
  sessionMock.mockReset();
  for (const k of Object.keys(calls)) delete calls[k];
});

async function loadFor(session: object | null) {
  sessionMock.mockResolvedValue(session);
  const s = await sessionModule.requireUserSession();
  if (!s) return null;
  return getHoyDashboard(s.userId, new Date("2026-10-06T18:00:00Z"), {
    vista: "hoy",
    actividad: "todas",
    canConversations: s.role === "admin",
  });
}

describe("/hoy — identidad canónica users.id", () => {
  it("cuenta heredada: todos los loaders con dueño reciben users.id", async () => {
    await loadFor(sesionConPuente(OWNER_A));
    for (const name of OWNER_SCOPED) expect(calls[name]?.[0], name).toBe(OWNER_A);
  });

  it("cuenta SIN firebase_uid — el defecto original — funciona igual", async () => {
    const d = await loadFor(sesionSinPuente(OWNER_A));
    expect(d).not.toBeNull();
    for (const name of OWNER_SCOPED) expect(calls[name]?.[0], name).toBe(OWNER_A);
  });

  it("el alias heredado nunca llega a una consulta", async () => {
    await loadFor(sesionConPuente(OWNER_A));
    expect(JSON.stringify(calls)).not.toContain(LEGACY_UID);
  });

  it("no cruza propietarios", async () => {
    await loadFor(sesionSinPuente(OWNER_B));
    for (const name of OWNER_SCOPED) expect(calls[name]?.[0], name).toBe(OWNER_B);
  });

  it("sin sesión no hay tablero (la página redirige a /login)", async () => {
    await expect(loadFor(null)).resolves.toBeNull();
    expect(Object.keys(calls)).toEqual([]);
  });

  it("las consultas de /hoy no mencionan firebase_uid ni getFullCrmData", () => {
    const root = resolve(__dirname, "..", "..");
    for (const file of ["lib/hoy/queries/snapshot-queries.ts", "lib/hoy/dashboard.ts", "app/(admin)/hoy/page.tsx"]) {
      const src = readFileSync(resolve(root, file), "utf8");
      expect(src, file).not.toMatch(/firebase_?uid|firebaseUid/i);
      expect(src, file).not.toContain("getFullCrmData(");
    }
  });
});

describe("código muerto retirado", () => {
  it("el módulo de sesión ya no exporta requireAdmin", () => {
    expect("requireAdmin" in sessionModule).toBe(false);
  });

  it("exporta solo la resolucion canonica; la heredada fue retirada (Gate B6)", () => {
    expect(typeof sessionModule.getSessionUserId).toBe("function");
    expect("getSessionUid" in sessionModule).toBe(false);
  });
});
