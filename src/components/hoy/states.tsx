"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Estado vacío honesto: dice qué no hay, sin cifras inventadas. */
export function EmptyState({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("py-6 text-center text-sm text-muted-foreground", className)}>{children}</p>;
}

/** Un loader caído se ve aquí; el resto de la página sigue. */
export function WidgetError({ what, className }: { what: string; className?: string }) {
  const router = useRouter();
  return (
    <div role="status" className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}>
      <AlertCircle className="h-5 w-5 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">No se pudo cargar {what}.</p>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RotateCw className="h-3.5 w-3.5" aria-hidden />
        Reintentar
      </button>
    </div>
  );
}
