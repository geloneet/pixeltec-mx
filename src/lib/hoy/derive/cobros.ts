import type { CobroRow, WidgetResult } from "@/lib/hoy/types";
import type { HoySnapshot } from "@/lib/hoy/snapshot";
import { diffDayKeys, zonedDayKey } from "./date-windows";
import { UNPAID_BILLING, formatPesosWithCode, indexClients, need, rows } from "./common";

const MAX_ROWS = 3;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** «Cobros y pagos»: los 3 cobros sin pagar más próximos (o vencidos). */
export function deriveCobros(snap: HoySnapshot): WidgetResult<CobroRow[]> {
  const check = need(snap, "billing", "clients");
  if (!check.ok) return check;
  const today = zonedDayKey(snap.now);
  const clients = indexClients(rows(snap.clients));

  const data = rows(snap.billing)
    .filter((b) => UNPAID_BILLING.has(b.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, MAX_ROWS)
    .map((b): CobroRow => {
      const diff = diffDayKeys(b.dueDate, today);
      const chip =
        diff < 0
          ? { label: `Vencido hace ${plural(-diff, "día", "días")}`, tone: "red" as const }
          : diff === 0
            ? { label: "Vence hoy", tone: "red" as const }
            : { label: `Vence en ${plural(diff, "día", "días")}`, tone: "amber" as const };
      return {
        id: b.id,
        clientName: clients.get(b.clientPgId)?.name ?? "Cliente",
        concept: b.concept,
        amountText: formatPesosWithCode(b.amount, b.currency),
        dueDate: b.dueDate,
        chip,
      };
    });
  return { ok: true, data };
}
