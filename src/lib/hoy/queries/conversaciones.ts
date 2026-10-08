import "server-only";
/**
 * Conversaciones de WhatsApp para /hoy — SOLO LECTURA (WhatsApp/PixelBot está
 * congelado: módulo `protected`). Reutiliza el único punto de salida hacia
 * PixelBot (`fetchPixelbot`) con la misma ruta que ya consume
 * /api/whatsapp-inbox/conversations, con un tope de 2.5 s: si PixelBot no
 * responde, /hoy degrada a «Sin datos de conversaciones», nunca se cae.
 *
 * Solo para admin: es el mismo permiso que exige la API del inbox
 * (`requireWhatsAppReviewAccess`); staff no ve previews de WhatsApp.
 */
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappContacts } from "@/lib/db/schema";
import { fetchPixelbot } from "@/lib/whatsapp-inbox/pixelbot-client";
import { parseCanonical } from "@/lib/whatsapp-inbox/time";
import type { InboxConversation } from "@/types/whatsapp-inbox";
import type { SnapClient, SnapConversation } from "@/lib/hoy/snapshot";
import type { ConversationsStatus } from "@/lib/hoy/types";

export const PIXELBOT_HOY_TIMEOUT_MS = 2_500;
const MAX_CONVERSATIONS = 50;

/** El bot entrega UTC sin sufijo; transportarlo como ISO evita que el navegador lo lea como hora local. */
function messageTimestamp(value: string | undefined): string | null {
  if (!value) return null;
  const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? parseCanonical(value) : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

/** Últimos 10 dígitos: iguala +52 1 322…, 52322… y 322…. */
export function phoneKey(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.slice(-10);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("pixelbot_hoy_timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Vincula conversaciones con clientes: `whatsapp_contacts.linked_client_id` y, si no, teléfono normalizado. */
export function linkConversations(
  conversations: InboxConversation[],
  clients: SnapClient[],
  linked: Map<string, string>,
): SnapConversation[] {
  const byPublicOrPg = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const c of clients) {
    byPublicOrPg.set(c.publicId, c.pgId);
    byPublicOrPg.set(c.pgId, c.pgId);
    for (const p of c.phones) {
      const key = phoneKey(p);
      if (key.length === 10 && !byPhone.has(key)) byPhone.set(key, c.pgId);
    }
  }
  return conversations
    .filter((c) => typeof c.id === "string" && c.id.length > 0)
    .sort((a, b) => Date.parse(messageTimestamp(b.lastMessageAt) ?? "") - Date.parse(messageTimestamp(a.lastMessageAt) ?? "") || 0)
    .slice(0, MAX_CONVERSATIONS)
    .map((c) => {
      const linkedId = linked.get(c.id);
      const clientPgId = (linkedId ? byPublicOrPg.get(linkedId) : undefined) ?? byPhone.get(phoneKey(c.id)) ?? null;
      return {
        phone: c.id,
        clientPgId,
        lastMessageAt: messageTimestamp(c.lastMessageAt),
        preview: c.lastMessagePreview?.trim() || null,
        direction: c.lastMessageDirection ?? null,
        unread: typeof c.unreadCount === "number" && c.unreadCount > 0 ? c.unreadCount : 0,
      };
    });
}

export async function loadConversations(
  canSee: boolean,
  clients: SnapClient[],
): Promise<{ status: ConversationsStatus; items: SnapConversation[] }> {
  if (!canSee) return { status: "not_allowed", items: [] };
  const tenantId = process.env.PIXELBOT_TENANT_ID;
  if (!tenantId) return { status: "unavailable", items: [] };
  try {
    const { data } = await withTimeout(
      fetchPixelbot(`/internal/conversations?tenant_id=${encodeURIComponent(tenantId)}`, undefined, "GET"),
      PIXELBOT_HOY_TIMEOUT_MS,
    );
    const list = (data as { conversations?: InboxConversation[] } | null)?.conversations;
    if (!Array.isArray(list)) return { status: "unavailable", items: [] };
    const phones = list.map((c) => c.id).filter(Boolean).slice(0, 500);
    const linkedRows = phones.length
      ? await db
          .select({ phone: whatsappContacts.phone, linkedClientId: whatsappContacts.linkedClientId })
          .from(whatsappContacts)
          .where(inArray(whatsappContacts.phone, phones))
      : [];
    const linked = new Map(
      linkedRows.filter((r) => r.linkedClientId).map((r) => [r.phone, r.linkedClientId as string]),
    );
    return { status: "ok", items: linkConversations(list, clients, linked) };
  } catch (error) {
    console.warn("[hoy] conversaciones no disponibles:", error instanceof Error ? error.message : "error");
    return { status: "unavailable", items: [] };
  }
}
