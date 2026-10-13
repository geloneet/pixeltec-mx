import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = vi.hoisted(() => ({
  role: "admin" as string | null,
  id: "owner-a",
}));
const load = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  requireUserSession: async () =>
    identity.role
      ? {
          userId: identity.id,
          role: identity.role,
          email: "qa@example.invalid",
        }
      : null,
}));
vi.mock("@/lib/hoy/dashboard", () => ({ getHoyDashboard: load }));
import { GET } from "./route";

beforeEach(() => {
  identity.role = "admin";
  identity.id = "owner-a";
  load.mockReset();
  load.mockResolvedValue({
    kpis: { ok: true, data: [] },
    actividad: { ok: true, data: [] },
  });
});
describe("Resumen de Inicio protegido", () => {
  it("rechaza visitantes antes de consultar datos", async () => {
    identity.role = null;
    expect((await GET()).status).toBe(401);
    expect(load).not.toHaveBeenCalled();
  });
  it("rechaza reviewer antes de consultar datos", async () => {
    identity.role = "reviewer";
    expect((await GET()).status).toBe(403);
    expect(load).not.toHaveBeenCalled();
  });
  it.each(["admin", "staff"])(
    "%s consulta únicamente su propietario y evita una segunda llamada PixelBot",
    async (role) => {
      identity.role = role;
      identity.id = "owner-b";
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(load).toHaveBeenCalledWith("owner-b", expect.any(Date), {
        vista: "hoy",
        actividad: "todas",
        canConversations: false,
      });
    },
  );
  it("no expone detalles privados del error del proveedor", async () => {
    load.mockRejectedValue(new Error("private-host-and-credential"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private-host");
  });
});
