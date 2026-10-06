import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import type { PriorityRow, WidgetResult } from "@/lib/hoy/types";
import { formatDueEs, formatRelativeEs } from "@/lib/hoy/derive/date-windows";
import { SectionCard } from "./section-card";
import { ChannelChip, StatusChip } from "./chips";
import { ClientAvatar } from "./client-avatar";
import { PriorityRowMenu } from "./priority-row-menu";
import { EmptyState, WidgetError } from "./states";

function Row({ row, now }: { row: PriorityRow; now: Date }) {
  const relative = formatRelativeEs(row.messageAt, now);
  const due = row.nextAction ? formatDueEs(row.nextAction.dueAt, now) : null;
  const clientHref = `/clientes/${encodeURIComponent(row.clientId)}`;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-t border-border py-3.5 first:border-t-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1.4fr)_auto_auto_minmax(0,11rem)_auto_auto]">
      {/* Cliente */}
      <Link
        href={clientHref}
        className="group col-span-2 flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:col-span-1"
      >
        <ClientAvatar name={row.clientName} logoUrl={row.logoUrl} color={row.color} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground group-hover:underline">{row.clientName}</span>
          {row.channel && (
            <span className="mt-1 block">
              <ChannelChip channel={row.channel} />
            </span>
          )}
        </span>
        <ChevronRight className="hidden h-4 w-4 flex-shrink-0 text-muted-foreground md:block" aria-hidden />
      </Link>

      {/* Mensaje */}
      <div className="col-span-3 min-w-0 md:col-span-1">
        {row.message ? (
          <p className="line-clamp-2 text-[13px] leading-snug text-foreground/90">{row.message}</p>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sin conversaciones registradas</p>
        )}
        {relative && <p className="mt-0.5 text-xs text-muted-foreground">{relative}</p>}
      </div>

      {/* Estado + monto */}
      <div className="col-span-3 flex items-center gap-3 md:contents">
        <StatusChip status={row.status} />
        <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
          {row.amountText ?? <span className="font-normal text-muted-foreground">—<span className="sr-only">Sin monto</span></span>}
        </p>
      </div>

      {/* Siguiente acción */}
      <div className="col-span-3 min-w-0 md:col-span-1">
        <p className="text-[11px] font-medium text-muted-foreground">Siguiente acción</p>
        {row.nextAction ? (
          <>
            <p className="truncate text-[13px] text-foreground">{row.nextAction.label}</p>
            {due && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {due}
              </p>
            )}
          </>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sin próxima acción</p>
        )}
      </div>

      {/* Acciones */}
      <div className="col-span-3 flex items-center justify-end gap-1 md:col-span-2">
        <Link
          href={row.cta.href}
          className="inline-flex h-9 items-center whitespace-nowrap rounded-lg bg-primary/10 px-3.5 text-[13px] font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {row.cta.label}
        </Link>
        <PriorityRowMenu clientName={row.clientName} clientId={row.clientId} />
      </div>
    </li>
  );
}

export function PrioritiesPanel({
  result,
  title,
  nowIso,
  conversationsNote,
}: {
  result: WidgetResult<{ rows: PriorityRow[]; total: number }>;
  title: string;
  nowIso: string;
  /** Aviso cuando PixelBot no respondió (degradación honesta). */
  conversationsNote?: string | null;
}) {
  const now = new Date(nowIso);
  return (
    <SectionCard
      id="prioridades"
      title={title}
      count={result.ok ? result.data.total : null}
      countLabel={result.ok ? `${result.data.total} prioridades` : undefined}
      action={{ label: "Ver todas", href: "/clientes" }}
      bodyClassName="pb-2"
    >
      {conversationsNote && <p className="mb-2 rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">{conversationsNote}</p>}
      {!result.ok ? (
        <WidgetError what="las prioridades" />
      ) : result.data.rows.length === 0 ? (
        <EmptyState>Sin prioridades por ahora.</EmptyState>
      ) : (
        <ul>
          {result.data.rows.map((row) => (
            <Row key={row.id} row={row} now={now} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
