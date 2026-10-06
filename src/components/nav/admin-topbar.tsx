"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import { HoyViewTabs } from "@/components/hoy/hoy-view-tabs";
import { NuevaCotizacionButton } from "@/components/hoy/nueva-cotizacion-button";
import { useUserProfile } from "@/hooks/use-user-profile";
import { isRestrictedRole } from "@/lib/routes/reviewer-access";
import { cn } from "@/lib/utils";
import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import type { NavArea } from "./nav-config";

/**
 * Topbar — desktop (`lg:` y superior), compañero de AppSidebar.
 * WO-2026-00515 (mockup «Centro Comercial»): buscador ancho (abre el ⌘K
 * existente), vistas de Inicio solo en /hoy, «Nueva cotización», campana y
 * usuario. El mobile sigue usando TopNavigation — ver Shell en layout.tsx.
 */
export function AdminTopbar({
  activeArea,
  className,
}: {
  activeArea: NavArea | null;
  className?: string;
}) {
  const { setOpen } = useCmdK();
  const pathname = usePathname();
  const { userProfile } = useUserProfile();
  const canQuote = !userProfile?.role || !isRestrictedRole(userProfile.role);
  const onHoy = activeArea === "hoy" || pathname === "/hoy";

  return (
    <header
      className={cn(
        "h-16 w-full flex-shrink-0 items-center gap-4 border-b border-border bg-card px-6",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir buscador"
        className="flex h-10 min-w-[180px] max-w-[440px] flex-1 items-center gap-2.5 rounded-lg border border-border bg-muted/50 px-3 text-left text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search className="h-4 w-4 flex-shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13px]">Buscar clientes, conversaciones, cotizaciones...</span>
        <kbd className="hidden flex-shrink-0 items-center rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground xl:inline-flex">
          ⌘K
        </kbd>
      </button>

      <div className="flex min-w-0 flex-shrink-0 justify-center xl:mx-auto">
        {onHoy && (
          <Suspense fallback={null}>
            <HoyViewTabs className="hidden xl:block" />
          </Suspense>
        )}
      </div>

      <div className="ml-auto flex flex-shrink-0 items-center gap-3">
        {canQuote && <NuevaCotizacionButton />}
        <NotificationsMenu />
        <UserMenu />
      </div>
    </header>
  );
}
