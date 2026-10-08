import type { ReactNode } from "react";

/** Detalle secundario disponible sin competir con las prioridades de Inicio. */
export function DetailsPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
