import Link from "next/link";
import { Check } from "lucide-react";
import type { ChecklistItem, WidgetResult } from "@/lib/hoy/types";
import { formatTimeEs } from "@/lib/hoy/derive/date-windows";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { EmptyState, WidgetError } from "./states";

const MAX_ITEMS = 6;

/**
 * «Hoy debes hacer esto» — derivado y de solo lectura (D-5): las casillas se
 * marcan solas con la evidencia del día; cada ítem lleva al lugar donde se
 * hace la acción.
 */
export function ChecklistPanel({ result, nowIso }: { result: WidgetResult<ChecklistItem[]>; nowIso: string }) {
  const items = result.ok ? result.data : [];
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  void nowIso;

  return (
    <SectionCard
      id="checklist"
      title="Hoy debes hacer esto"
      aside={result.ok && items.length > 0 ? <span className="text-[13px] font-medium tabular-nums text-muted-foreground">{done}/{items.length}</span> : undefined}
    >
      {!result.ok ? (
        <WidgetError what="los pendientes del día" />
      ) : items.length === 0 ? (
        <EmptyState>Nada pendiente para hoy.</EmptyState>
      ) : (
        <>
          <div
            role="progressbar"
            aria-label="Avance del día"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
          </div>
          <ul className="flex flex-col">
            {items.slice(0, MAX_ITEMS).map((item) => {
              const time = item.at ? formatTimeEs(item.at) : null;
              return (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center gap-3 rounded-md py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      role="checkbox"
                      aria-checked={item.done}
                      aria-disabled="true"
                      aria-label={item.label}
                      className={cn(
                        "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border",
                        item.done ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                      )}
                    >
                      {item.done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
                    </span>
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", item.done ? "text-muted-foreground" : "text-foreground")}>
                      {item.label}
                    </span>
                    <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground">{time ?? "Todo el día"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {items.length > MAX_ITEMS && <p className="mt-1 text-xs text-muted-foreground">+{items.length - MAX_ITEMS} más</p>}
        </>
      )}
    </SectionCard>
  );
}
