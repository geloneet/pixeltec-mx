"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { HOY_VIEWS, parseHoyView } from "./hoy-views";

/**
 * Segmented control de vistas de /hoy (mockup «Centro Comercial»). Son
 * enlaces a `/hoy?vista=…`, no estado local: la vista es compartible y el
 * servidor filtra Prioridades con ella.
 */
export function HoyViewTabs({ className }: { className?: string }) {
  const params = useSearchParams();
  const active = parseHoyView(params?.get("vista"));

  return (
    <nav aria-label="Vistas de Inicio" className={cn("min-w-0", className)}>
      <ul className="flex items-center gap-1 overflow-x-auto rounded-lg bg-muted/70 p-1 scrollbar-none">
        {HOY_VIEWS.map((view) => {
          const isActive = view.id === active;
          return (
            <li key={view.id} className="flex-shrink-0">
              <Link
                href={view.href}
                scroll={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
