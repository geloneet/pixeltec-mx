"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  FolderKanban,
  Users,
  MessageCircle,
  FileText,
  CircleDollarSign,
  CalendarDays,
  BarChart3,
  Workflow,
  Newspaper,
  UserCog,
  Sparkles,
  type LucideIcon,
  Search,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SITE } from "@/lib/site-config";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useUnreadConversations } from "@/hooks/use-unread-conversations";
import type { ModuleId } from "@/lib/modules/registry";
import {
  getPrimaryNavAreas,
  getMoreNavAreas,
  getPlannedNavItems,
  NAV_AREA_LABELS,
  getAreaHref,
  getSecondaryItems,
  resolveActiveHref,
  type NavArea,
} from "./nav-config";
import { PALETTE_NAV_ITEMS } from "./command-palette-items";

/**
 * Icono representativo de cada área L1 (ADR-0030). Deliberadamente distinto
 * del icono del primer sub-ítem de PALETTE_NAV_ITEMS cuando ese ítem no
 * comunica bien el dominio completo (p. ej. "marketing" usa Megaphone en vez
 * del LayoutGrid del hub "Resumen").
 */
const AREA_ICONS: Record<NavArea, LucideIcon> = {
  hoy: Home,
  crm: Users,
  whatsapp: MessageCircle,
  finanzas: CircleDollarSign,
  cotizaciones: FileText,
  proyectos: FolderKanban,
  blog: Newspaper,
  seo: Search,
  usuarios: UserCog,
};

/** Iconos de los módulos `planned` (filas «Pronto», WO-2026-00515). */
const PLANNED_ICONS: Partial<Record<ModuleId, LucideIcon>> = {
  calendario: CalendarDays,
  reportes: BarChart3,
  automatizaciones: Workflow,
};

/** Tarjeta estática del pie del sidebar (mockup; sin botón de video: no existe video). */
function SidebarPromoCard() {
  return (
    <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-4">
      <Sparkles className="h-4 w-4 text-primary" strokeWidth={2} aria-hidden />
      <p className="mt-2 text-sm font-semibold leading-snug text-foreground">Tu equipo comercial, potenciado</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Mensajes, clientes y ventas en un solo lugar.</p>
    </div>
  );
}

/**
 * Sidebar vertical — desktop (`lg:` y superior). WO-2026-00515: estética del
 * mockup «Centro Comercial» (blanco, 232px, activo en azul claro), grupo
 * comercial arriba, filas «Pronto» de los módulos `planned` y el resto de
 * áreas tras «Más». El mobile conserva TopNavigation + SecondaryNavigation.
 *
 * Fuente de navegación: el mismo catálogo de nav-config.ts (ADR-0030) y el
 * registro central de módulos — cero taxonomía nueva.
 */
export function AppSidebar({
  activeArea,
  className,
}: {
  activeArea: NavArea | null;
  className?: string;
}) {
  const pathname = usePathname();
  const unread = useUnreadConversations();

  const activeHref = resolveActiveHref(PALETTE_NAV_ITEMS, pathname);
  // WO-2026-00051: el reviewer no ve áreas (solo presentación; el middleware manda).
  const { userProfile } = useUserProfile();
  const role = userProfile?.role;
  const primaryAreas = getPrimaryNavAreas(role);
  const moreAreas = getMoreNavAreas(role);
  const planned = getPlannedNavItems(role);

  /**
   * Qué área tiene el submenú desplegado (Miguel, 2026-09-03):
   *  - entrar al área por su página principal ⇒ colapsado;
   *  - llegar directo a una página profunda ⇒ expandido;
   *  - navegar DENTRO de la misma área ⇒ se respeta lo que el usuario dejó;
   *  - cambiar de área ⇒ se reevalúa.
   */
  const [expandedArea, setExpandedArea] = useState<NavArea | null>(null);
  useEffect(() => {
    setExpandedArea((prev) => {
      if (!activeArea) return null;
      if (prev === activeArea) return prev;
      return activeHref === getAreaHref(activeArea) ? null : activeArea;
    });
  }, [activeArea, activeHref]);

  const rowBase =
    "relative flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const renderArea = (area: NavArea) => {
    const Icon = AREA_ICONS[area];
    const active = area === activeArea;
    const secondaryItems = getSecondaryItems(area);
    const hasChildren = secondaryItems.length > 1;
    const expanded = expandedArea === area;
    const submenuId = `sidebar-submenu-${area}`;
    const badge = area === "whatsapp" && unread !== null && unread > 0 ? unread : null;

    return (
      <li key={area} className="flex flex-col">
        <div className="relative flex items-center">
          <Link
            href={getAreaHref(area)}
            aria-current={active ? "page" : undefined}
            className={cn(
              rowBase,
              active
                ? "bg-sidebar-accent font-semibold text-primary"
                : "font-medium text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} aria-hidden />
            <span className="flex-1 truncate">{NAV_AREA_LABELS[area]}</span>
            {badge !== null && (
              <span
                aria-label={`${badge} conversaciones sin leer`}
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold tabular-nums text-white"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>

          {active && hasChildren && (
            <button
              type="button"
              onClick={() => setExpandedArea((prev) => (prev === area ? null : area))}
              aria-expanded={expanded}
              aria-controls={submenuId}
              aria-label={`${expanded ? "Ocultar" : "Mostrar"} submenú de ${NAV_AREA_LABELS[area]}`}
              className="absolute right-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight
                className={cn("h-4 w-4 transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-90")}
                strokeWidth={2}
              />
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && hasChildren && (
            <motion.div
              id={submenuId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="ml-[1.4rem] mt-1 flex flex-col gap-0.5 border-l border-sidebar-border py-1 pl-3">
                {secondaryItems.map((item) => {
                  const subActive = item.href === activeHref;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={subActive ? "page" : undefined}
                      className={cn(
                        "truncate rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
                        subActive
                          ? "bg-sidebar-accent text-primary"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      {item.secondaryLabel}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "w-[232px] flex-shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5",
        className
      )}
      aria-label="Navegación principal"
    >
      {/* Marca */}
      <Link href="/hoy" className="mb-6 flex items-center gap-2.5 rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Image
          src={process.env.NEXT_PUBLIC_LOGO_URL ?? SITE.logoPath}
          alt="PixelTEC Logo"
          width={30}
          height={30}
          className="h-[30px] w-[30px] flex-shrink-0"
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-lg font-bold tracking-tight text-foreground">PixelTEC</span>
          <span className="truncate text-[11px] font-medium text-muted-foreground">Centro Comercial</span>
        </span>
      </Link>

      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-none">
        <ul className="flex flex-col gap-0.5">
          {primaryAreas.map(renderArea)}
          {planned.map((item) => {
            const Icon = PLANNED_ICONS[item.module] ?? CalendarDays;
            return (
              <li key={item.module}>
                <div
                  aria-disabled="true"
                  title={`${item.label}: próximamente`}
                  className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground/70"
                >
                  <Icon className="h-[18px] w-[18px] flex-shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="flex-1 truncate">{item.label}</span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Pronto
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        {moreAreas.length > 0 && (
          <>
            <p className="mb-1 mt-5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Más
            </p>
            <ul className="flex flex-col gap-0.5">{moreAreas.map(renderArea)}</ul>
          </>
        )}
      </nav>

      <div className="mt-4">
        <SidebarPromoCard />
      </div>
    </aside>
  );
}
