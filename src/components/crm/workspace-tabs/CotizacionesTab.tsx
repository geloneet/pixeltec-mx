"use client";

/**
 * Pestaña «Cotizaciones» del workspace de cliente (WO-2026-00102 → 00104).
 *
 * Orquesta las tres vistas: listado, formulario y detalle. **Sin IA en ningún
 * punto** — la cotización la escribe Miguel.
 *
 * Ninguna de las tres calcula importes por su cuenta: todo viene de
 * `@/lib/quotes/money` y `@/lib/quotes/terms` (§30, fuente única).
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayStatus, followUpLabel, formatAmount, formatShortDate, totalsFor } from "@/lib/quotes/terms";
import { QuoteForm } from "./quote-form";
import { QuoteDetail } from "./quote-detail";
import { StatusBadge, type QuoteView } from "./quote-shared";
import { browserSessionStorage, isNuevaConsumed, markNuevaConsumed } from "@/components/hoy/nueva-cotizacion-intent";

export type { QuoteView } from "./quote-shared";

type View = { kind: "list" } | { kind: "form"; quote: QuoteView | null } | { kind: "detail"; id: string };

interface Props {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  quotes: QuoteView[];
  siteUrl: string;
  onChanged: () => void;
}

export function CotizacionesTab({
  clientId,
  clientName,
  clientEmail,
  clientPhone,
  quotes,
  siteUrl,
  onChanged,
}: Props) {
  // WO-2026-00515 (D-7): «+ Nueva cotización» del topbar llega con
  // `?nueva=<token>` y abre directo el formulario de una cotización nueva.
  // WO-2026-00519: el token es de un solo uso (sessionStorage; la URL no se
  // toca — ver nueva-cotizacion-intent.ts). Se consume al salir del
  // formulario nuevo, en `pagehide` (refresh/cierre) o al desmontarse con otra
  // URL (se navegó a otra parte). NO al montar: el `AnimatePresence` del shell
  // remonta la página al terminar la animación de entrada, y ese segundo
  // montaje (misma URL) debe seguir mostrando el formulario.
  const searchParams = useSearchParams();
  const nuevaToken = searchParams?.get("nueva") ?? null;
  const [view, setView] = useState<View>(() =>
    nuevaToken && !isNuevaConsumed(nuevaToken, browserSessionStorage()) ? { kind: "form", quote: null } : { kind: "list" }
  );

  useEffect(() => {
    if (!nuevaToken) return;
    const storage = browserSessionStorage();
    if (isNuevaConsumed(nuevaToken, storage)) return;
    const consume = () => markNuevaConsumed(nuevaToken, storage);
    window.addEventListener("pagehide", consume);
    return () => {
      window.removeEventListener("pagehide", consume);
      if (new URLSearchParams(window.location.search).get("nueva") !== nuevaToken) consume();
    };
  }, [nuevaToken]);

  // Salir del formulario nuevo (cancelar, guardar → detalle) también lo consume.
  const leftNewForm = view.kind !== "form";
  useEffect(() => {
    if (nuevaToken && leftNewForm) markNuevaConsumed(nuevaToken, browserSessionStorage());
  }, [nuevaToken, leftNewForm]);

  if (view.kind === "form") {
    return (
      <QuoteForm
        clientId={clientId}
        clientName={clientName}
        quote={view.quote}
        onCancel={() => setView(view.quote ? { kind: "detail", id: view.quote.id } : { kind: "list" })}
        onSaved={(id) => {
          onChanged();
          setView({ kind: "detail", id });
        }}
      />
    );
  }

  if (view.kind === "detail") {
    const quote = quotes.find((q) => q.id === view.id);
    // Tras guardar, la lista aún no se ha recargado: se muestra el listado un
    // instante en vez de una pantalla en blanco.
    if (!quote) return <QuoteList quotes={quotes} onOpen={(id) => setView({ kind: "detail", id })} onNew={() => setView({ kind: "form", quote: null })} clientName={clientName} />;
    return (
      <QuoteDetail
        quote={quote}
        clientName={clientName}
        clientEmail={clientEmail}
        clientPhone={clientPhone}
        siteUrl={siteUrl}
        onBack={() => setView({ kind: "list" })}
        onEdit={() => setView({ kind: "form", quote })}
        onChanged={onChanged}
      />
    );
  }

  return (
    // p-6: mismo padding que las pestañas hermanas Resumen (px-4 py-6) y
    // Finanzas (p-6) respecto a la barra de tabs — antes faltaba aquí y se
    // veía apretado (Miguel, 2026-09-08).
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Cotizaciones</h2>
          <p className="text-xs text-muted-foreground">
            De la propuesta al cobro: crear, enviar, dar seguimiento y cerrar.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setView({ kind: "form", quote: null })}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nueva cotización
        </Button>
      </div>

      <QuoteList
        quotes={quotes}
        clientName={clientName}
        onOpen={(id) => setView({ kind: "detail", id })}
        onNew={() => setView({ kind: "form", quote: null })}
      />
    </div>
  );
}

// ── Listado (§24) ────────────────────────────────────────────────────────────

function QuoteList({
  quotes,
  clientName,
  onOpen,
  onNew,
}: {
  quotes: QuoteView[];
  clientName: string;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  const now = new Date();

  if (quotes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">Todavía no hay cotizaciones para {clientName}.</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onNew}>
          Crear la primera
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Folio</th>
            <th className="px-4 py-2.5 font-medium">Cotización</th>
            <th className="px-4 py-2.5 text-right font-medium">Total</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 font-medium">Vigencia</th>
            <th className="px-4 py-2.5 font-medium">Seguimiento</th>
          </tr>
        </thead>
        <tbody>
          {quotes.map((quote) => {
            const status = displayStatus(quote, now);
            const totals = totalsFor(quote.items, quote.taxEnabled);
            const follow = followUpLabel(quote.nextFollowUpAt, status, now);
            return (
              <tr
                key={quote.id}
                onClick={() => onOpen(quote.id)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-accent/40"
              >
                <td className="px-4 py-3">
                  <code className="text-xs text-muted-foreground">{quote.folio}</code>
                </td>
                <td className="max-w-[240px] truncate px-4 py-3 text-foreground">{quote.title}</td>
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
                  {formatAmount(totals.totalCents, quote.currency)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatShortDate(quote.validUntil) ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {follow === "Seguimiento pendiente" ? (
                    <span className="text-amber-500">Pendiente</span>
                  ) : (
                    (follow ?? "—")
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
