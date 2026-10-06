import type { CobroRow, WidgetResult } from "@/lib/hoy/types";
import { SectionCard } from "./section-card";
import { ToneChip } from "./chips";
import { EmptyState, WidgetError } from "./states";

/** «Cobros y pagos»: lectura de Finanzas (módulo protegido, sin escrituras). */
export function CobrosPanel({ result }: { result: WidgetResult<CobroRow[]> }) {
  return (
    <SectionCard id="cobros" title="Cobros y pagos" action={{ label: "Ver todos", href: "/cobros" }}>
      {!result.ok ? (
        <WidgetError what="los cobros" />
      ) : result.data.length === 0 ? (
        <EmptyState>Sin cobros pendientes.</EmptyState>
      ) : (
        <ul className="flex flex-col">
          {result.data.map((row) => (
            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-t border-border py-2.5 first:border-t-0">
              <span className="min-w-0 truncate text-[13px] font-semibold text-foreground" title={`${row.clientName} · ${row.concept}`}>
                {row.clientName}
                <span className="sr-only"> · {row.concept}</span>
              </span>
              <span className="whitespace-nowrap text-xs font-medium tabular-nums text-foreground">{row.amountText}</span>
              <ToneChip tone={row.chip.tone} className="px-1.5 text-[11px]">{row.chip.label}</ToneChip>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
