import type { BillingItem } from "@/types/documents";
export {
  saleStages,
  saleStageLabel,
  projectStages,
  projectStageLabel,
} from "@/lib/commercial/model";
export function money(cents: number, currency: string) {
  try {
    return (
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(cents / 100) +
      " " +
      currency
    );
  } catch {
    return (cents / 100).toFixed(2) + " " + currency;
  }
}
export function balanceCents(bill: BillingItem) {
  if (bill.status === "pagado" || bill.status === "cancelado") return 0;
  return Math.max(
    0,
    Math.round(bill.amount * 100) -
      bill.paymentHistory
        .filter((p) => p.periodKey === bill.dueDate)
        .reduce((sum, p) => sum + Math.round(p.amount * 100), 0),
  );
}
export function totalsLabel(
  rows: readonly { currency: string; cents: number }[],
) {
  const sums = new Map<string, number>();
  rows.forEach((r) =>
    sums.set(r.currency, (sums.get(r.currency) ?? 0) + r.cents),
  );
  return (
    [...sums].map(([currency, cents]) => money(cents, currency)).join(" · ") ||
    "Sin importes"
  );
}
export function todayCivil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
  }).format(new Date());
}
export function dateLabel(day: string | null | undefined) {
  if (!day) return "Sin fecha";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    timeZone: "America/Mexico_City",
  }).format(new Date(day.length === 10 ? day + "T12:00:00Z" : day));
}
export function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}
