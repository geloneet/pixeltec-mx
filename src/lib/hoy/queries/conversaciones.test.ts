import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const fetchPixelbot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({ fetchPixelbot }));
const whereMock = vi.hoisted(() => vi.fn(async () => [{ phone: "5213220000001", linkedClientId: "pub-velank" }]));
vi.mock("@/lib/db", () => ({ db: { select: () => ({ from: () => ({ where: whereMock }) }) } }));

import { linkConversations, loadConversations, phoneKey, PIXELBOT_HOY_TIMEOUT_MS } from "./conversaciones";
import { client } from "../__tests__/fixtures";

const clients = [
  client({ pgId: "c-smile", name: "Smile", phones: ["+52 1 (322) 123-4567"] }),
  client({ pgId: "c-velank", publicId: "pub-velank", name: "Velank" }),
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  fetchPixelbot.mockReset();
});

describe("vinculación de conversaciones", () => {
  it("normaliza teléfonos a 10 dígitos", () => {
    expect(phoneKey("5213221234567")).toBe("3221234567");
    expect(phoneKey("+52 1 (322) 123-4567")).toBe("3221234567");
  });

  it("vincula por linked_client_id y, si no, por teléfono; nunca a clientes ajenos", () => {
    const out = linkConversations(
      [
        { id: "5213221234567", lastMessageAt: "2026-10-06T10:00:00Z", lastMessagePreview: "Hola", lastMessageDirection: "inbound", unreadCount: 2 },
        { id: "5213220000001", lastMessageAt: "2026-10-06T09:00:00Z" },
        { id: "5219999999999", lastMessageAt: "2026-10-06T08:00:00Z" },
      ],
      clients,
      new Map([["5213220000001", "pub-velank"]]),
    );
    expect(out.map((c) => c.clientPgId)).toEqual(["c-smile", "c-velank", null]);
    expect(out[0]).toMatchObject({ preview: "Hola", unread: 2, direction: "inbound" });
    expect(out[1]).toMatchObject({ preview: null, unread: 0 });
  });
});

describe("loadConversations (solo lectura, degradación)", () => {
  it("staff: no consulta PixelBot", async () => {
    await expect(loadConversations(false, clients)).resolves.toEqual({ status: "not_allowed", items: [] });
    expect(fetchPixelbot).not.toHaveBeenCalled();
  });

  it("sin tenant configurado: no disponible", async () => {
    vi.stubEnv("PIXELBOT_TENANT_ID", "");
    await expect(loadConversations(true, clients)).resolves.toEqual({ status: "unavailable", items: [] });
  });

  it("PixelBot caído: no disponible, sin lanzar", async () => {
    vi.stubEnv("PIXELBOT_TENANT_ID", "t1");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchPixelbot.mockRejectedValue(new Error("pixelbot_unreachable"));
    await expect(loadConversations(true, clients)).resolves.toEqual({ status: "unavailable", items: [] });
  });

  it("PixelBot lento: corta a los 2.5 s", async () => {
    vi.stubEnv("PIXELBOT_TENANT_ID", "t1");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers();
    fetchPixelbot.mockReturnValue(new Promise(() => {}));
    const p = loadConversations(true, clients);
    await vi.advanceTimersByTimeAsync(PIXELBOT_HOY_TIMEOUT_MS + 1);
    await expect(p).resolves.toEqual({ status: "unavailable", items: [] });
  });

  it("usa la misma ruta de lectura que el inbox (GET /internal/conversations)", async () => {
    vi.stubEnv("PIXELBOT_TENANT_ID", "t1");
    fetchPixelbot.mockResolvedValue({ data: { conversations: [{ id: "5213220000001", lastMessageAt: "2026-10-06T09:00:00Z" }] }, status: 200 });
    const out = await loadConversations(true, clients);
    expect(fetchPixelbot).toHaveBeenCalledWith("/internal/conversations?tenant_id=t1", undefined, "GET");
    expect(out.status).toBe("ok");
    expect(out.items[0].clientPgId).toBe("c-velank");
  });
});
