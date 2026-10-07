"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { useCRM } from "@/components/crm/CRMContextCore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { browserSessionStorage, markNuevaIntent } from "./nueva-cotizacion-intent";

/**
 * «+ Nueva cotización» (D-7): una cotización siempre pertenece a un cliente,
 * así que primero se elige el cliente y se abre su pestaña de cotizaciones
 * con el formulario nuevo (`?tab=cotizaciones&nueva=1`). WO-2026-00519: antes
 * de navegar deja una intención de un solo uso para que refresh/atrás/adelante
 * no reabran el formulario (ver `nueva-cotizacion-intent.ts`).
 *
 * La lista sale del CRM ya cargado en el shell (`useCRM`, clientes del owner):
 * no se añade otro endpoint de servidor para esto.
 */
export function NuevaCotizacionButton({ className }: { className?: string }) {
  const router = useRouter();
  const { clients, loading } = useCRM();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...clients].sort((a, b) => a.name.localeCompare(b.name, "es"));
    return q ? list.filter((c) => c.name.toLowerCase().includes(q)) : list;
  }, [clients, query]);

  const choose = (id: string) => {
    setOpen(false);
    markNuevaIntent(id, browserSessionStorage());
    router.push(`/clientes/${encodeURIComponent(id)}?tab=cotizaciones&nueva=1`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-10 flex-shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
        Nueva cotización
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva cotización</DialogTitle>
            <DialogDescription>Elige el cliente; se abrirá su pestaña de cotizaciones.</DialogDescription>
          </DialogHeader>
          <label className="relative block">
            <span className="sr-only">Buscar cliente</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar cliente…"
              className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <ul className="max-h-72 overflow-y-auto" aria-label="Clientes">
            {loading ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">Cargando clientes…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                {clients.length === 0 ? "Aún no tienes clientes." : "Ningún cliente coincide."}
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c.id)}
                    className="w-full rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    {c.name}
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
