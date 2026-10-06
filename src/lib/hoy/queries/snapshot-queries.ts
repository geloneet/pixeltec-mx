import "server-only";
/**
 * Consultas de la instantánea comercial de /hoy (WO-2026-00515).
 *
 * Solo lectura. Scoping por dueño: `clients.owner_id`, `billing_items.owner_id`,
 * `client_activity.owner_id`, `notifications.user_id`; `quotes`/`sales` por JOIN
 * a `clients`, `payment_records` por JOIN a `billing_items`. `leads` NO tiene
 * owner: es el feed global (igual que /clientes/leads).
 *
 * Cada `build*Query` devuelve el query builder sin ejecutarlo (los tests
 * inspeccionan su SQL con `.toSQL()`); cada `load*` lo ejecuta y mapea a la
 * forma serializable de `snapshot.ts`.
 */
import { and, desc, eq, gte, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  billingItems,
  clientActivity,
  clients,
  leads,
  notifications,
  paymentRecords,
  quotes,
  sales,
  users,
} from "@/lib/db/schema";
import { displayStatus, parsePaymentTerms, totalsFor } from "@/lib/quotes/terms";
import type { QuoteItem } from "@/lib/quotes/money";
import { addDaysToKey, keyToZonedStart, zonedDayKey } from "@/lib/hoy/derive/date-windows";
import type {
  SnapActivity,
  SnapBilling,
  SnapClient,
  SnapLead,
  SnapNotification,
  SnapPayment,
  SnapQuote,
  SnapSale,
} from "@/lib/hoy/snapshot";

const DAY_MS = 86_400_000;
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);
const dateOnly = (v: string | Date) => (typeof v === "string" ? v.slice(0, 10) : v.toISOString().slice(0, 10));

function parseNextAction(raw: unknown): SnapClient["nextAction"] {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.label !== "string" || !v.label.trim()) return null;
  return { label: v.label, dueAt: typeof v.dueAt === "string" && v.dueAt ? v.dueAt : null };
}

// ── Clientes ─────────────────────────────────────────────────────────────────

export function buildClientsQuery(ownerId: string) {
  return db
    .select({
      id: clients.id,
      firestoreId: clients.firestoreId,
      name: clients.name,
      logoUrl: clients.logoUrl,
      color: clients.color,
      crmStatus: clients.crmStatus,
      nextAction: clients.nextAction,
      whatsapp: clients.whatsapp,
      phone: clients.phone,
    })
    .from(clients)
    .where(eq(clients.ownerId, ownerId));
}

export async function loadClients(ownerId: string): Promise<SnapClient[]> {
  const rows = await buildClientsQuery(ownerId);
  return rows.map((r) => ({
    pgId: r.id,
    publicId: r.firestoreId ?? r.id,
    name: r.name,
    logoUrl: r.logoUrl,
    color: r.color,
    crmStatus: r.crmStatus,
    nextAction: parseNextAction(r.nextAction),
    phones: [r.whatsapp, r.phone].filter((p): p is string => !!p && p.trim().length > 0),
  }));
}

// ── Cotizaciones ─────────────────────────────────────────────────────────────

export function buildQuotesQuery(ownerId: string, now: Date) {
  const since = new Date(now.getTime() - 35 * DAY_MS);
  return db
    .select({
      id: quotes.id,
      clientId: quotes.clientId,
      folio: quotes.folio,
      title: quotes.title,
      status: quotes.status,
      items: quotes.items,
      taxEnabled: quotes.taxEnabled,
      currency: quotes.currency,
      validUntil: quotes.validUntil,
      problem: quotes.problem,
      solution: quotes.solution,
      scopeIncluded: quotes.scopeIncluded,
      paymentTerms: quotes.paymentTerms,
      sentAt: quotes.sentAt,
      acceptedAt: quotes.acceptedAt,
      rejectedAt: quotes.rejectedAt,
      nextFollowUpAt: quotes.nextFollowUpAt,
    })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(
      and(
        eq(clients.ownerId, ownerId),
        or(inArray(quotes.status, ["borrador", "enviada"]), gte(quotes.updatedAt, since)),
      ),
    )
    .orderBy(desc(quotes.createdAt))
    .limit(500);
}

export async function loadQuotes(ownerId: string, now: Date): Promise<SnapQuote[]> {
  const rows = await buildQuotesQuery(ownerId, now);
  return rows.map((r) => {
    const items = Array.isArray(r.items) ? (r.items as QuoteItem[]) : [];
    const status = displayStatus(
      {
        title: r.title,
        items,
        validUntil: iso(r.validUntil),
        problem: r.problem,
        solution: r.solution,
        scopeIncluded: r.scopeIncluded,
        paymentTerms: parsePaymentTerms(r.paymentTerms),
        status: r.status,
      },
      now,
    );
    return {
      id: r.id,
      clientPgId: r.clientId,
      folio: r.folio,
      title: r.title,
      status,
      totalCents: totalsFor(items, r.taxEnabled).totalCents,
      currency: r.currency,
      sentAt: iso(r.sentAt),
      acceptedAt: iso(r.acceptedAt),
      rejectedAt: iso(r.rejectedAt),
      nextFollowUpAt: iso(r.nextFollowUpAt),
    };
  });
}

// ── Ventas ───────────────────────────────────────────────────────────────────

export function buildSalesQuery(ownerId: string, now: Date) {
  const since = new Date(now.getTime() - 31 * DAY_MS);
  return db
    .select({
      id: sales.id,
      clientId: sales.clientId,
      status: sales.status,
      title: sales.title,
      acceptedAt: sales.acceptedAt,
      totalCents: sales.oneTimeTotalCents,
      currency: sales.currency,
    })
    .from(sales)
    .innerJoin(clients, eq(clients.id, sales.clientId))
    .where(and(eq(clients.ownerId, ownerId), or(eq(sales.status, "pendiente_anticipo"), gte(sales.acceptedAt, since))))
    .limit(300);
}

export async function loadSales(ownerId: string, now: Date): Promise<SnapSale[]> {
  const rows = await buildSalesQuery(ownerId, now);
  return rows.map((r) => ({
    id: r.id,
    clientPgId: r.clientId,
    status: r.status,
    title: r.title,
    acceptedAt: r.acceptedAt.toISOString(),
    totalCents: r.totalCents,
    currency: r.currency,
  }));
}

// ── Cobros (billing_items) ───────────────────────────────────────────────────

export function buildBillingQuery(ownerId: string, now: Date) {
  const from = addDaysToKey(zonedDayKey(now), -14);
  return db
    .select({
      id: billingItems.id,
      clientId: billingItems.clientId,
      concept: billingItems.concept,
      amount: billingItems.amount,
      currency: billingItems.currency,
      status: billingItems.status,
      dueDate: billingItems.dueDate,
    })
    .from(billingItems)
    .where(
      and(
        eq(billingItems.ownerId, ownerId),
        ne(billingItems.status, "cancelado"),
        or(inArray(billingItems.status, ["pendiente", "parcial", "vencido"]), gte(billingItems.dueDate, from)),
      ),
    )
    .orderBy(billingItems.dueDate)
    .limit(500);
}

export async function loadBilling(ownerId: string, now: Date): Promise<SnapBilling[]> {
  const rows = await buildBillingQuery(ownerId, now);
  return rows.map((r) => ({
    id: r.id,
    clientPgId: r.clientId,
    concept: r.concept,
    amount: Number(r.amount),
    currency: r.currency,
    status: r.status,
    dueDate: dateOnly(r.dueDate),
  }));
}

// ── Pagos ────────────────────────────────────────────────────────────────────

export function buildPaymentsQuery(ownerId: string, now: Date) {
  const today = zonedDayKey(now);
  const prevMonthStart = addDaysToKey(`${today.slice(0, 7)}-01`, -1).slice(0, 7) + "-01";
  const weekAgo = addDaysToKey(today, -7);
  const from = prevMonthStart < weekAgo ? prevMonthStart : weekAgo;
  return db
    .select({
      id: paymentRecords.id,
      billingItemId: paymentRecords.billingItemId,
      clientId: billingItems.clientId,
      amount: paymentRecords.amount,
      currency: billingItems.currency,
      paidAt: paymentRecords.paidAt,
      createdAt: paymentRecords.createdAt,
    })
    .from(paymentRecords)
    .innerJoin(billingItems, eq(billingItems.id, paymentRecords.billingItemId))
    .where(and(eq(billingItems.ownerId, ownerId), gte(paymentRecords.paidAt, from)))
    .limit(1000);
}

export async function loadPayments(ownerId: string, now: Date): Promise<SnapPayment[]> {
  const rows = await buildPaymentsQuery(ownerId, now);
  return rows.map((r) => ({
    id: r.id,
    billingItemId: r.billingItemId,
    clientPgId: r.clientId,
    amount: Number(r.amount),
    currency: r.currency,
    paidAt: dateOnly(r.paidAt),
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Leads (feed global, sin owner) ───────────────────────────────────────────

export function buildLeadsQuery(now: Date) {
  const since = keyToZonedStart(addDaysToKey(zonedDayKey(now), -8));
  return db
    .select({
      id: leads.id,
      name: leads.name,
      empresa: leads.empresa,
      email: leads.email,
      status: leads.status,
      createdAt: leads.createdAt,
      wantsContact: leads.wantsContact,
      wantsContactAt: leads.wantsContactAt,
      clientId: leads.clientId,
    })
    .from(leads)
    .where(or(gte(leads.createdAt, since), inArray(leads.status, ["new", "contacted", "qualified"])))
    .orderBy(desc(leads.createdAt))
    .limit(300);
}

export async function loadLeads(now: Date): Promise<SnapLead[]> {
  const rows = await buildLeadsQuery(now);
  return rows.map((r) => ({
    id: r.id,
    name: r.empresa?.trim() || r.name?.trim() || r.email,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    wantsContact: r.wantsContact,
    wantsContactAt: iso(r.wantsContactAt),
    clientPgId: r.clientId,
  }));
}

// ── Actividad del cliente ────────────────────────────────────────────────────

export function buildActivityQuery(ownerId: string, now: Date) {
  const since = new Date(now.getTime() - 30 * DAY_MS);
  return db
    .select({
      id: clientActivity.id,
      clientId: clientActivity.clientId,
      type: clientActivity.type,
      message: clientActivity.message,
      createdAt: clientActivity.createdAt,
    })
    .from(clientActivity)
    .where(and(eq(clientActivity.ownerId, ownerId), gte(clientActivity.createdAt, since)))
    .orderBy(desc(clientActivity.createdAt))
    .limit(50);
}

export async function loadActivity(ownerId: string, now: Date): Promise<SnapActivity[]> {
  const rows = await buildActivityQuery(ownerId, now);
  return rows.map((r) => ({
    id: r.id,
    clientPgId: r.clientId,
    type: r.type,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ── Notificaciones (alertas) ─────────────────────────────────────────────────

export function buildNotificationsQuery(ownerId: string) {
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      href: notifications.href,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, ownerId),
        eq(notifications.read, false),
        inArray(notifications.type, ["warning", "alert", "error"]),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(10);
}

export async function loadNotifications(ownerId: string): Promise<SnapNotification[]> {
  const rows = await buildNotificationsQuery(ownerId);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

// ── Nombre del usuario (saludo) ──────────────────────────────────────────────

export async function loadUserFirstName(ownerId: string): Promise<string | null> {
  const [row] = await db.select({ name: users.name }).from(users).where(eq(users.id, ownerId)).limit(1);
  const first = row?.name?.trim().split(/\s+/)[0];
  return first ? first : null;
}
