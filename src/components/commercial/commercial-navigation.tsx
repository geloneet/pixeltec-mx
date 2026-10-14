"use client";
import Link from "next/link";
import {
  LayoutDashboard, Activity, UsersRound, MessageCircle, BriefcaseBusiness,
  WalletCards, Settings, FileText, Newspaper, Search, UserRoundCog,
  ChevronUp, type LucideIcon,
} from "lucide-react";
import {
  getAreaHref, getPrimaryNavAreas, getMoreNavAreas, NAV_AREA_LABELS,
  type NavArea,
} from "@/components/nav/nav-config";

const icons: Record<NavArea, LucideIcon> = {
  hoy: LayoutDashboard,
  ventas: Activity,
  crm: UsersRound,
  whatsapp: MessageCircle,
  proyectos: BriefcaseBusiness,
  finanzas: WalletCards,
  ajustes: Settings,
  cotizaciones: FileText,
  blog: Newspaper,
  seo: Search,
  usuarios: UserRoundCog,
};
const groups: { label: string; areas: NavArea[] }[] = [
  { label: "Comercial", areas: ["hoy", "ventas", "crm", "whatsapp"] },
  { label: "Operación", areas: ["cotizaciones", "proyectos", "finanzas"] },
  { label: "General", areas: ["ajustes"] },
];

/** Presentation groups only: the existing catalog still determines visibility by role. */
export function CommercialNavigation({
  role, activeArea,
}: { role?: string; activeArea: NavArea | null }) {
  const visible = [...getPrimaryNavAreas(role), ...getMoreNavAreas(role)];
  const grouped = new Set(groups.flatMap((group) => group.areas));
  const sections = [
    ...groups.map((group) => ({
      label: group.label,
      areas: group.areas.filter((area) => visible.includes(area)),
    })),
    { label: "Más herramientas", areas: visible.filter((area) => !grouped.has(area)) },
  ].filter((group) => group.areas.length);
  return (
    <nav className="cc-navigation" aria-label="Navegación principal" key={activeArea}>
      {sections.map((group) => (
        <details className="cc-nav-group" key={group.label} open>
          <summary>{group.label}<ChevronUp size={14} strokeWidth={1.5} aria-hidden /></summary>
          {group.areas.map((area) => {
            const Icon = icons[area];
            return (
              <Link
                key={area}
                href={getAreaHref(area)}
                aria-current={activeArea === area ? "page" : undefined}
                className={"cc-nav-link" + (activeArea === area ? " selected" : "")}
              >
                <Icon size={18} strokeWidth={1.45} aria-hidden />
                <span>{NAV_AREA_LABELS[area]}</span>
              </Link>
            );
          })}
        </details>
      ))}
    </nav>
  );
}
