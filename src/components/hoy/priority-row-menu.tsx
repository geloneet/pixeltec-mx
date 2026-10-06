"use client";

import Link from "next/link";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Kebab de una prioridad: solo navegación (sin escrituras desde /hoy). */
export function PriorityRowMenu({ clientName, clientId }: { clientName: string; clientId: string }) {
  const base = `/clientes/${encodeURIComponent(clientId)}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Más acciones para ${clientName}`}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link href={base}>Abrir cliente</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`${base}?tab=cotizaciones`}>Ver cotizaciones</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/cobros">Ver cobros</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
