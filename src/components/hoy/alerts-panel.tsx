import Link from "next/link";
import { AlertTriangle, Bell, FileText, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import type { AlertKind, AlertRow, WidgetResult } from "@/lib/hoy/types";
import { diffDayKeys, toDayKey, zonedDayKey } from "@/lib/hoy/derive/date-windows";
import { cn } from "@/lib/utils";
import { SectionCard } from "./section-card";
import { TONE_TILE } from "./tones";
import { EmptyState, WidgetError } from "./states";

const ICONS: Record<AlertKind, LucideIcon> = {
  sin_respuesta: AlertTriangle,
  cotizacion_abierta: FileText,
  lead_contacto: Sparkles,
  cobro_vencido: Wallet,
  notificacion: Bell,
};

function age(at: string | null, now: Date): string | null {
  const key = toDayKey(at);
  if (!key) return null;
  const d = diffDayKeys(zonedDayKey(now), key);
  if (d <= 0) return "Hoy";
  return `${d} ${d === 1 ? "día" : "días"}`;
}

export function AlertsPanel({ result, nowIso }: { result: WidgetResult<{ rows: AlertRow[]; total: number }>; nowIso: string }) {
  const now = new Date(nowIso);
  return (
    <SectionCard
      id="alertas"
      title="Alertas"
      count={result.ok && result.data.total > result.data.rows.length ? result.data.total : null}
      countLabel={result.ok ? `${result.data.total} alertas` : undefined}
      action={{ label: "Ver todas", href: "/notificaciones" }}
    >
      {!result.ok ? (
        <WidgetError what="las alertas" />
      ) : result.data.rows.length === 0 ? (
        <EmptyState>Sin alertas.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.data.rows.map((a) => {
            const Icon = ICONS[a.kind];
            const ago = age(a.at, now);
            return (
              <li key={a.id}>
                <Link href={a.href} className="flex items-start gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full", TONE_TILE[a.tone])}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">{a.title}</span>
                    <span className="block text-xs leading-snug text-muted-foreground">{a.description}</span>
                  </span>
                  {ago && <span className="flex-shrink-0 text-xs text-muted-foreground">{ago}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
