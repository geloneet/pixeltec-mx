"use client";

import { useCallback, useEffect, useState } from "react";
import { useUserProfile } from "@/hooks/use-user-profile";

/**
 * Total de conversaciones de WhatsApp sin leer para el badge «Conversaciones»
 * del sidebar (WO-2026-00515). SOLO LECTURA de la misma API que usa el inbox.
 *
 * - Solo admin: staff recibe 403 en `/api/whatsapp-inbox/conversations`, así
 *   que ni se consulta (`null` = sin badge). El reviewer queda fuera también:
 *   su shell está pausado por `RestrictedShellBoundary` y no ve el sidebar.
 * - Polling cada 60 s y al volver el foco; pausa con la pestaña oculta.
 * - Errores silenciosos: sin dato, sin badge.
 */
export const UNREAD_POLL_MS = 60_000;

export function sumUnread(data: unknown): number {
  const list = (data as { conversations?: { unreadCount?: unknown }[] } | null)?.conversations;
  if (!Array.isArray(list)) return 0;
  return list.reduce((sum, c) => {
    const n = typeof c?.unreadCount === "number" && c.unreadCount > 0 ? c.unreadCount : 0;
    return sum + (n > 0 ? 1 : 0);
  }, 0);
}

export function useUnreadConversations(): number | null {
  const { userProfile } = useUserProfile();
  const enabled = userProfile?.role === "admin";
  const [count, setCount] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp-inbox/conversations", { cache: "no-store" });
      if (!res.ok) { setCount(null); return; }
      setCount(sumUnread(await res.json()));
    } catch {
      setCount(null);
      // Sin dato vigente no se conserva un contador antiguo.
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(null);
      return;
    }
    void refresh();
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!interval) interval = setInterval(() => void refresh(), UNREAD_POLL_MS);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        void refresh();
        start();
      }
    };
    const onFocus = () => void refresh();
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  return enabled ? count : null;
}
