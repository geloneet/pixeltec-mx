import type { WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot, SnapClient, SnapQuote } from "@/lib/hoy/snapshot";
import { toDayKey, zonedDayKey } from "./date-windows";

/** Desenvuelve las piezas que un widget necesita; si alguna falló, el widget falla. */
export function need<K extends keyof HoySnapshot>(
  snap: HoySnapshot,
  ...keys: K[]
): { ok: true } | { ok: false; error: string } {
  for (const key of keys) {
    const piece = snap[key] as unknown as WidgetResult<unknown> | undefined;
    if (piece && typeof piece === "object" && "ok" in piece && !piece.ok) {
      return { ok: false, error: `${String(key)}: ${piece.error}` };
    }
  }
  return { ok: true };
}

/** Datos de una pieza ya verificada con `need` (o `[]` si falló). */
export function rows<T>(piece: WidgetResult<T[]>): T[] {
  return piece.ok ? piece.data : [];
}

const mxn0 = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** «$48,000» (pesos, sin centavos). */
export function formatPesos(amount: number): string {
  return mxn0.format(Math.round(amount));
}

/** «$48,000 MXN» — como en el mockup. Para otra moneda, el código correcto. */
export function formatPesosWithCode(amount: number, currency = "MXN"): string {
  return `${formatPesos(amount)} ${currency || "MXN"}`;
}

export function formatCents(cents: number, currency = "MXN"): string {
  return formatPesosWithCode(cents / 100, currency);
}

export function indexClients(clients: SnapClient[]): Map<string, SnapClient> {
  return new Map(clients.map((c) => [c.pgId, c]));
}

export function clientHref(client: SnapClient | undefined, tab?: string): string {
  if (!client) return "/clientes";
  return `/clientes/${encodeURIComponent(client.publicId)}${tab ? `?tab=${tab}` : ""}`;
}

/**
 * Regla `needsFollowUp` de `quotes/terms.ts` (enviada + seguimiento hoy o
 * vencido), evaluada en el día calendario de CDMX en vez del huso del
 * servidor.
 */
export function followUpState(quote: SnapQuote, now: Date): "vencido" | "hoy" | "futuro" | null {
  if (quote.status !== "enviada") return null;
  const key = toDayKey(quote.nextFollowUpAt);
  if (!key) return null;
  const today = zonedDayKey(now);
  if (key < today) return "vencido";
  if (key === today) return "hoy";
  return "futuro";
}

export const UNPAID_BILLING = new Set(["pendiente", "parcial", "vencido"]);

export function isoTime(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T06:00:00Z` : value);
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}
