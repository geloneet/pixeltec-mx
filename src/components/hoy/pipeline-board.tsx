import Link from "next/link";
import type { PipelineColumn, WidgetResult } from "@/lib/hoy/types";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { TONE_COLUMN } from "./tones";
import { EmptyState, WidgetError } from "./states";

function Column({ col }: { col: PipelineColumn }) {
  const tone = TONE_COLUMN[col.tone];
  return (
    <div className={cn("flex min-w-[200px] snap-start flex-col rounded-lg p-2.5", tone.column)}>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className={cn("truncate text-[13px] font-semibold", tone.title)}>{col.label}</h3>
        <span className="text-xs font-medium tabular-nums text-muted-foreground">{col.count}</span>
      </div>
      <ul role="list" aria-label={`Etapa ${col.label}, ${col.count} ${col.count === 1 ? "oportunidad" : "oportunidades"}`} className="flex flex-col gap-2">
        {col.cards.map((card) => (
          <li key={card.id}>
            <Link
              href={card.href}
              className="block rounded-md border border-border bg-card px-3 py-2 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block truncate text-[13px] font-medium text-foreground">{card.name}</span>
              {card.amountText && <span className="block text-xs tabular-nums text-muted-foreground">{card.amountText}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {col.count === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">Sin oportunidades</p>}
      {col.more > 0 && <p className="mt-2 px-1 text-xs font-medium text-muted-foreground">+{col.more} más</p>}
    </div>
  );
}

/** Pipeline comercial derivado (D-4): 7 etapas, sin columna nueva en BD. */
export function PipelineBoard({ result }: { result: WidgetResult<{ columns: PipelineColumn[]; total: number }> }) {
  return (
    <SectionCard
      id="pipeline"
      title="Pipeline comercial"
      aside={
        result.ok ? (
          <span className="mr-auto rounded-md bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {result.data.total} {result.data.total === 1 ? "oportunidad" : "oportunidades"}
          </span>
        ) : undefined
      }
      action={{ label: "Ver pipeline completo", href: "/clientes" }}
    >
      {!result.ok ? (
        <WidgetError what="el pipeline" />
      ) : result.data.total === 0 ? (
        <EmptyState>Aún no hay oportunidades en el pipeline.</EmptyState>
      ) : (
        <div className="-mx-1 grid snap-x auto-cols-[minmax(200px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-1">
          {result.data.columns.map((col) => (
            <Column key={col.id} col={col} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}
