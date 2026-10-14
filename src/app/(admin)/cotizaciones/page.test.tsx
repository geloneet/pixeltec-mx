import { beforeEach, describe, expect, it, vi } from "vitest";
const deps = vi.hoisted(() => ({
  session: vi.fn(),
  quotes: vi.fn(),
  redirect: vi.fn(),
  commercial: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireUserSession: deps.session }));
vi.mock("@/lib/quotes/dashboard-queries", () => ({
  listQuotesForOwner: deps.quotes,
}));
vi.mock("next/navigation", () => ({ redirect: deps.redirect }));
vi.mock("@/components/commercial/commercial-page", () => ({
  CommercialPage: deps.commercial,
}));
import Page from "./page";
beforeEach(() => {
  vi.clearAllMocks();
  deps.quotes.mockResolvedValue([]);
  deps.redirect.mockImplementation(() => {
    throw new Error("login_redirect");
  });
});
describe("Cotizaciones conserva límites de sesión y la vista reviewer", () => {
  it.each(["admin", "staff"])(
    "abre el espacio comercial para %s",
    async (role) => {
      deps.session.mockResolvedValue({
        userId: "owner",
        email: "owner@example.invalid",
        role,
      });
      const page = await Page();
      expect(page.type).toBe(deps.commercial);
      expect(page.props).toEqual({ view: "quotes" });
      expect(deps.quotes).not.toHaveBeenCalled();
    },
  );
  it("mantiene la consulta existente para reviewer sin ampliar el acceso comercial", async () => {
    deps.session.mockResolvedValue({
      userId: "reviewer",
      email: "reviewer@example.invalid",
      role: "reviewer",
    });
    const page = await Page();
    expect(page.type).not.toBe(deps.commercial);
    expect(deps.quotes).toHaveBeenCalledOnce();
  });
  it("redirige a login antes de consultar datos sin sesión", async () => {
    deps.session.mockResolvedValue(null);
    await expect(Page()).rejects.toThrow("login_redirect");
    expect(deps.redirect).toHaveBeenCalledWith("/login?redirect=/cotizaciones");
    expect(deps.quotes).not.toHaveBeenCalled();
  });
});
