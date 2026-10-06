/**
 * Instantánea comercial del owner que alimenta todas las derivaciones de /hoy
 * (WO-2026-00515). Tipos puros: los loaders (`queries/*`) la llenan desde
 * Postgres/PixelBot y las derivaciones (`derive/*`) la leen sin BD.
 *
 * Cada pieza es un `WidgetResult` independiente: si falla la consulta de
 * cobros, solo los widgets que dependen de cobros muestran error.
 */
import type { QuoteStatus } from "@/lib/quotes/terms";
import type { ConversationsStatus, WidgetResult } from "./types";

export interface SnapClient {
  pgId: string;
  /** firestore_id ?? uuid — el id que usa /clientes/[id]. */
  publicId: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  crmStatus: string;
  nextAction: { label: string; dueAt: string | null } | null;
  phones: string[];
}

export interface SnapQuote {
  id: string;
  clientPgId: string;
  folio: string;
  title: string;
  /** Estado derivado (`displayStatus`, fuente única de terms.ts). */
  status: QuoteStatus;
  totalCents: number;
  currency: string;
  sentAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  nextFollowUpAt: string | null;
}

export interface SnapSale {
  id: string;
  clientPgId: string;
  status: string;
  title: string;
  acceptedAt: string;
  totalCents: number;
  currency: string;
}

export interface SnapBilling {
  id: string;
  clientPgId: string;
  concept: string;
  amount: number;
  currency: string;
  status: string;
  /** YYYY-MM-DD */
  dueDate: string;
}

export interface SnapPayment {
  id: string;
  billingItemId: string;
  clientPgId: string;
  amount: number;
  currency: string;
  /** YYYY-MM-DD */
  paidAt: string;
  createdAt: string;
}

export interface SnapLead {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  wantsContact: boolean;
  wantsContactAt: string | null;
  clientPgId: string | null;
}

export interface SnapActivity {
  id: string;
  clientPgId: string;
  type: string;
  message: string;
  createdAt: string;
}

export interface SnapNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
}

export interface SnapConversation {
  phone: string;
  clientPgId: string | null;
  lastMessageAt: string | null;
  preview: string | null;
  direction: "inbound" | "outbound" | null;
  unread: number;
}

export interface HoySnapshot {
  now: Date;
  clients: WidgetResult<SnapClient[]>;
  quotes: WidgetResult<SnapQuote[]>;
  sales: WidgetResult<SnapSale[]>;
  billing: WidgetResult<SnapBilling[]>;
  payments: WidgetResult<SnapPayment[]>;
  leads: WidgetResult<SnapLead[]>;
  activity: WidgetResult<SnapActivity[]>;
  notifications: WidgetResult<SnapNotification[]>;
  conversations: { status: ConversationsStatus; items: SnapConversation[] };
}
