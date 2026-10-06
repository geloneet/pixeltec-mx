// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * Regresión (2026-08-26) — el módulo SEO estaba registrado, sus rutas
 * respondían y los tests de taxonomía pasaban, pero **el pill nunca se
 * dibujaba**: sus destinos no estaban en `PALETTE_NAV_ITEMS`, que es donde
 * `areaItems()` los busca. Lo encontró Miguel abriendo el panel.
 *
 * Este archivo renderiza el sidebar de verdad y comprueba lo que se ve. Un
 * test sobre funciones puras no habría bastado: la cadena registro → catálogo
 * → área → pill solo se rompe al final.
 */
/** Mutable: los tests del submenú (WO-2026-00220) necesitan cambiar de ruta. */
let mockPathname = "/hoy";
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as { alt?: string; src?: string })} />,
}));

vi.mock("@/components/cmd-k/CmdKProvider", () => ({
  useCmdK: () => ({ open: false, setOpen: vi.fn() }),
}));

vi.mock("@/components/crm/CRMContextCore", () => ({
  useCRM: () => ({ loading: false, clients: [], tools: [], tasks: [] }),
}));

vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ profile: { name: "Miguel", role: "admin" }, isLoading: false }),
}));

const unread = vi.hoisted(() => ({ value: 3 as number | null }));
vi.mock("@/hooks/use-unread-conversations", () => ({
  useUnreadConversations: () => unread.value,
}));

import { AppSidebar } from "./app-sidebar";

afterEach(cleanup);
beforeEach(() => {
  mockPathname = "/hoy";
  unread.value = 3;
});

describe("sidebar del panel", () => {
  it("dibuja las áreas aprobadas, SEO incluida", () => {
    render(<AppSidebar activeArea={null} />);
    for (const label of [
      "Inicio",
      "Conversaciones",
      "Clientes",
      "Cobros",
      "Cotizaciones",
      "Trabajo",
      "Blog",
      "SEO",
      "Usuarios",
    ]) {
      expect(screen.getAllByText(label).length, `falta el área ${label}`).toBeGreaterThan(0);
    }
  });

  it("no dibuja las áreas de módulos borrados", () => {
    render(<AppSidebar activeArea={null} />);
    for (const label of ["Marketing", "Sistema"]) {
      expect(screen.queryByText(label), `${label} no debería verse`).toBeNull();
    }
  });

  it("la marca dice PixelTEC · Centro Comercial (mockup WO-2026-00515)", () => {
    const { container } = render(<AppSidebar activeArea={null} />);
    expect(container.textContent).toContain("PixelTEC");
    expect(container.textContent).toContain("Centro Comercial");
  });

  it("Calendario, Reportes y Automatizaciones: filas deshabilitadas «Pronto», sin enlace", () => {
    render(<AppSidebar activeArea={null} />);
    for (const label of ["Calendario", "Reportes", "Automatizaciones"]) {
      const row = screen.getByText(label).closest("[aria-disabled]");
      expect(row, label).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText(label).closest("a"), `${label} no debe ser enlace`).toBeNull();
    }
    expect(screen.getAllByText("Pronto")).toHaveLength(3);
  });

  it("separa con «Más» las áreas fuera del mockup y muestra la tarjeta del equipo", () => {
    render(<AppSidebar activeArea={null} />);
    expect(screen.getByText("Más")).toBeTruthy();
    expect(screen.getByText("Tu equipo comercial, potenciado")).toBeTruthy();
    expect(screen.queryByText(/ver video/i)).toBeNull();
  });

  it("badge de no leídos en Conversaciones solo con dato (admin)", () => {
    render(<AppSidebar activeArea={null} />);
    expect(screen.getByLabelText("3 conversaciones sin leer")).toBeTruthy();
    cleanup();
    unread.value = null;
    render(<AppSidebar activeArea={null} />);
    expect(screen.queryByLabelText(/conversaciones sin leer/)).toBeNull();
  });

  it("el área activa se marca con aria-current", () => {
    render(<AppSidebar activeArea="hoy" />);
    expect(screen.getByText("Inicio").closest("a")).toHaveAttribute("aria-current", "page");
  });
});

/**
 * WO-2026-00220 (Miguel, 2026-09-03): entrar a un área por su pill lleva a la
 * página principal SIN desplegar el submenú; el submenú se abre con un chevron
 * explícito. Llegar directo a una página profunda sí lo deja abierto, porque si
 * no el menú no explicaría dónde estás.
 */
describe("submenú desplegable del sidebar", () => {
  const chevron = (area: string) => screen.getByLabelText(new RegExp(`submenú de ${area}`, "i"));

  it("en la página principal del área el submenú está cerrado y el chevron lo anuncia", () => {
    mockPathname = "/seo/salud";
    render(<AppSidebar activeArea="seo" />);
    expect(chevron("SEO")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Redes")).toBeNull();
    expect(screen.queryByText("Sitemap")).toBeNull();
  });

  it("el chevron expande el submenú sin navegar", () => {
    mockPathname = "/seo/salud";
    render(<AppSidebar activeArea="seo" />);
    fireEvent.click(chevron("SEO"));
    expect(chevron("SEO")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Redes")).toBeTruthy();
  });

  it("llegar directo a una página profunda deja el submenú abierto sin clic", () => {
    mockPathname = "/seo/redes";
    render(<AppSidebar activeArea="seo" />);
    expect(chevron("SEO")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Redes")).toBeTruthy();
  });

  it("un área sin sub-páginas no dibuja chevron", () => {
    mockPathname = "/whatsapp";
    render(<AppSidebar activeArea="whatsapp" />);
    expect(screen.queryByLabelText(/submenú de WhatsApp/i)).toBeNull();
  });

  it("el área de Clientes (CRM) también tiene chevron, sin código propio", () => {
    mockPathname = "/clientes";
    render(<AppSidebar activeArea="crm" />);
    const button = chevron("Clientes");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Leads")).toBeNull();
    fireEvent.click(button);
    expect(screen.getByText("Leads")).toBeTruthy();
  });

  it("el área inactiva nunca muestra su submenú ni su chevron", () => {
    mockPathname = "/blog-cms";
    render(<AppSidebar activeArea="blog" />);
    expect(screen.queryByLabelText(/submenú de SEO/i)).toBeNull();
    expect(screen.queryByText("Sitemap")).toBeNull();
  });
});
