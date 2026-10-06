import "server-only";
/**
 * Orquestador de /hoy «Centro Comercial» (WO-2026-00515).
 *
 * - Sin `"use server"`: no es un endpoint RPC, solo código de servidor.
 * - La sesión se resuelve UNA vez en la página; aquí llega `ownerId`.
 * - Ya no usa `getFullCrmData`, `listProjects` ni `listQuotesForOwner`.
 * - Cada pieza de la instantánea se carga aislada (`settle`): una consulta
 *   caída solo apaga los widgets que dependen de ella.
 */
import type { HoyViewId } from "@/components/hoy/hoy-views";
import type { ActivityFilter, HoyDashboard, WidgetResult } from "./types";
import type { HoySnapshot, SnapClient } from "./snapshot";
import {
  loadActivity,
  loadBilling,
  loadClients,
  loadLeads,
  loadNotifications,
  loadPayments,
  loadQuotes,
  loadSales,
  loadUserFirstName,
} from "./queries/snapshot-queries";
import { loadConversations } from "./queries/conversaciones";
import { deriveDashboard } from "./dashboard-derive";

export { deriveDashboard };

export async function settle<T>(run: () => Promise<T>): Promise<WidgetResult<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    console.error("[hoy] loader falló:", error instanceof Error ? error.message : error);
    return { ok: false, error: "load_failed" };
  }
}

export interface SnapshotLoaders {
  clients: () => Promise<SnapClient[]>;
  quotes: () => Promise<HoySnapshot["quotes"] extends WidgetResult<infer T> ? T : never>;
  sales: () => Promise<HoySnapshot["sales"] extends WidgetResult<infer T> ? T : never>;
  billing: () => Promise<HoySnapshot["billing"] extends WidgetResult<infer T> ? T : never>;
  payments: () => Promise<HoySnapshot["payments"] extends WidgetResult<infer T> ? T : never>;
  leads: () => Promise<HoySnapshot["leads"] extends WidgetResult<infer T> ? T : never>;
  activity: () => Promise<HoySnapshot["activity"] extends WidgetResult<infer T> ? T : never>;
  notifications: () => Promise<HoySnapshot["notifications"] extends WidgetResult<infer T> ? T : never>;
  conversations: (clients: SnapClient[]) => Promise<HoySnapshot["conversations"]>;
}

export function defaultLoaders(ownerId: string, now: Date, canConversations: boolean): SnapshotLoaders {
  return {
    clients: () => loadClients(ownerId),
    quotes: () => loadQuotes(ownerId, now),
    sales: () => loadSales(ownerId, now),
    billing: () => loadBilling(ownerId, now),
    payments: () => loadPayments(ownerId, now),
    leads: () => loadLeads(now),
    activity: () => loadActivity(ownerId, now),
    notifications: () => loadNotifications(ownerId),
    conversations: (clients) => loadConversations(canConversations, clients),
  };
}

/** Carga todas las piezas en paralelo; ninguna falla tumba a las demás. */
export async function buildSnapshot(now: Date, loaders: SnapshotLoaders): Promise<HoySnapshot> {
  const clientsP = settle(loaders.clients);
  const [clients, quotes, sales, billing, payments, leads, activity, notifications] = await Promise.all([
    clientsP,
    settle(loaders.quotes),
    settle(loaders.sales),
    settle(loaders.billing),
    settle(loaders.payments),
    settle(loaders.leads),
    settle(loaders.activity),
    settle(loaders.notifications),
  ]);
  const conversations = await loaders
    .conversations(clients.ok ? clients.data : [])
    .catch(() => ({ status: "unavailable" as const, items: [] }));
  return { now, clients, quotes, sales, billing, payments, leads, activity, notifications, conversations };
}

/**
 * Punto de entrada de la página: una sola carga por request (la instantánea
 * alimenta todos los widgets; PixelBot está acotado a 2.5 s).
 */
export async function getHoyDashboard(
  ownerId: string,
  now: Date,
  opts: { vista: HoyViewId; actividad: ActivityFilter; canConversations: boolean },
): Promise<HoyDashboard> {
  const [snap, greetingName] = await Promise.all([
    buildSnapshot(now, defaultLoaders(ownerId, now, opts.canConversations)),
    loadUserFirstName(ownerId).catch(() => null),
  ]);
  return deriveDashboard(snap, { vista: opts.vista, actividad: opts.actividad, greetingName });
}
