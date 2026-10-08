// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const profile = vi.hoisted(() => ({ role: "admin" as string | undefined }));
vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ userProfile: profile.role ? { role: profile.role } : null }),
}));

import { useUnreadConversations, sumUnread, UNREAD_POLL_MS } from "./use-unread-conversations";

const fetchMock = vi.fn();

beforeEach(() => {
  profile.role = "admin";
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function ok(body: unknown) {
  return { ok: true, json: async () => body };
}

describe("sumUnread", () => {
  it("cuenta conversaciones, no mensajes, e ignora basura", () => {
    expect(sumUnread({ conversations: [{ unreadCount: 2 }, { unreadCount: 1 }, { unreadCount: -3 }, {}] })).toBe(2);
    expect(sumUnread(null)).toBe(0);
  });
});

describe("useUnreadConversations", () => {
  it("admin: cuenta conversaciones no leídas de la API del inbox", async () => {
    fetchMock.mockResolvedValue(ok({ conversations: [{ unreadCount: 2 }, { unreadCount: 1 }] }));
    const { result } = renderHook(() => useUnreadConversations());
    await waitFor(() => expect(result.current).toBe(2));
    expect(fetchMock).toHaveBeenCalledWith("/api/whatsapp-inbox/conversations", { cache: "no-store" });
  });

  it("staff: no consulta (la API responde 403) y no hay badge", async () => {
    profile.role = "staff";
    const { result } = renderHook(() => useUnreadConversations());
    expect(result.current).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("errores silenciosos: sin badge, sin lanzar", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { result } = renderHook(() => useUnreadConversations());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("vuelve a consultar cada 60 s", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(ok({ conversations: [] }));
    renderHook(() => useUnreadConversations());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(UNREAD_POLL_MS + 10);
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
