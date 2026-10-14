"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site-config";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, Mail, ChevronDown, Menu, X, LogOut } from "lucide-react";
import { CommercialNavigation } from "./commercial-navigation";
import { signOut } from "next-auth/react";
import {
  getActiveArea,
  getPrimaryNavAreas,
  NAV_AREA_LABELS,
} from "@/components/nav/nav-config";
import { useCmdK } from "@/components/cmd-k/CmdKProvider";
import "./commercial.css";
import "./motion.css";
export function PixeltecMark() {
  return (
    <span className="cc-brand">
      <Image src={SITE.logoPath} width={36} height={36} alt="" priority />
      <span>{SITE.name}</span>
    </span>
  );
}
export function CommercialShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const area = getActiveArea(pathname);
  const { data: session } = useSession();
  const role = session?.user?.role;
  const [menu, setMenu] = useState(false);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.commercialMotion = reduced
      ? "reduced"
      : "normal";
    return () => {
      delete document.documentElement.dataset.commercialMotion;
    };
  }, [reduced]);
  useEffect(() => {
    const read = () => {
      try {
        setReduced(
          localStorage.getItem("commercial-reduced-motion") === "true",
        );
      } catch {
        setReduced(false);
      }
    };
    read();
    window.addEventListener("commercial-motion-changed", read);
    return () => window.removeEventListener("commercial-motion-changed", read);
  }, []);
  const sidebar = useRef<HTMLElement>(null);
  const workspace = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const apply = () => {
      sidebar.current?.toggleAttribute("inert", media.matches && !menu);
      workspace.current?.toggleAttribute("inert", media.matches && menu);
    };
    apply();
    media.addEventListener("change", apply);
    if (!menu) return () => media.removeEventListener("change", apply);
    const previousOverflow = document.body.style.overflow;
    const workspaceNode = workspace.current,
      menuNode = menuButton.current;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      Array.from(
        sidebar.current?.querySelectorAll<HTMLElement>(
          "a[href],button,summary",
        ) || [],
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setMenu(false);
      }
      if (e.key === "Tab") {
        const list = focusable(),
          first = list[0],
          last = list.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keys);
    return () => {
      media.removeEventListener("change", apply);
      document.removeEventListener("keydown", keys);
      document.body.style.overflow = previousOverflow;
      workspaceNode?.removeAttribute("inert");
      menuNode?.focus();
    };
  }, [menu]);
  const { setOpen } = useCmdK();
  useEffect(() => {
    document.title =
      "PIXELTEC · " + (area ? NAV_AREA_LABELS[area] : "Centro Comercial");
    setMenu(false);
    const main = workspace.current?.querySelector<HTMLElement>(".cc-main");
    if (main) main.scrollTop = 0;
  }, [pathname, area]);
  const primary = getPrimaryNavAreas(role);
  return (
    <div
      className={
        "crm commercial cc-shell" + (reduced ? " cc-reduced-motion" : "")
      }
    >
      <a className="cc-skip" href="#commercial-main">
        Ir al contenido
      </a>
      <aside ref={sidebar} className={"cc-sidebar" + (menu ? " is-open" : "")}>
        <Link href="/hoy" className="cc-logo" aria-label="PixelTEC · Inicio">
          <PixeltecMark />
        </Link>
        <button
          className="cc-mobile-close cc-icon-button"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        >
          <X size={20} />
        </button>
        <button
          className="cc-search cc-side-search"
          onClick={() => setOpen(true)}
          aria-label="Buscar clientes, proyectos y acciones…"
        >
          <Search size={16} />
          <span>Buscar</span>
          <kbd>⌘ K</kbd>
        </button>
        <CommercialNavigation role={role} activeArea={area} />
        <div className="cc-account">
          <span className="cc-avatar">
            {(session?.user?.name || session?.user?.email || "PT")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <Link href="/perfil">
            <strong>{session?.user?.name || "Mi cuenta"}</strong>
            <span>
              {role === "admin" ? "Administrador" : "Equipo comercial"}
            </span>
          </Link>
          <button
            className="cc-icon-button"
            aria-label="Cerrar sesión"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="cc-menu-scrim"
          aria-label="Cerrar navegación"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="cc-workspace" ref={workspace}>
        <header className="cc-topbar">
          <button
            ref={menuButton}
            className="cc-menu-toggle cc-icon-button"
            aria-label="Abrir menú"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <Menu size={21} />
          </button>
          <span className="cc-topbar-title">
            {area ? NAV_AREA_LABELS[area] : "Centro Comercial"}
          </span>
          <button className="cc-search cc-top-search" onClick={() => setOpen(true)}>
            <Search size={17} />
            <span>Buscar clientes, proyectos y acciones…</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="cc-topbar-actions">
            {primary.includes("whatsapp") && (
              <Link
                href="/whatsapp"
                className="cc-icon-button"
                aria-label="Abrir conversaciones"
              >
                <Mail size={18} strokeWidth={1.5} />
              </Link>
            )}
            <Link href="/ajustes" className="cc-connection">
              <span className="cc-dot" />
              Revisar conexiones
              <ChevronDown size={14} />
            </Link>
          </div>
        </header>
        <main id="commercial-main" tabIndex={-1} className="cc-main">
          {children}
        </main>
      </div>
    </div>
  );
}
