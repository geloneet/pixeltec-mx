// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * WO-2026-00515: topbar del mockup «Centro Comercial» — buscador ancho que abre
 * ⌘K, vistas de /hoy (solo en /hoy), «Nueva cotización», campana y usuario
 * real con su rol (nunca un nombre fijo).
 */
let mockPathname = "/hoy";
let mockSearch = "";
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
  useRouter: () => ({ push }),
}));
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) =>
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img {...(props as { alt?: string; src?: string })} />,
}));
const setOpen = vi.fn();
vi.mock("@/components/cmd-k/CmdKProvider", () => ({ useCmdK: () => ({ open: false, setOpen }) }));
vi.mock("@/components/crm/CRMContextCore", () => ({
  useCRM: () => ({
    loading: false,
    clients: [
      { id: "cli-1", name: "Smile More Dental" },
      { id: "cli-2", name: "DALK" },
    ],
  }),
}));
vi.mock("./notifications-menu", () => ({ NotificationsMenu: () => <button aria-label="Notificaciones" /> }));
vi.mock("@/hooks/use-user", () => ({
  useUser: () => ({ displayName: "Miguel Robles", email: "m@x.mx", photoURL: null }),
}));
const role = vi.hoisted(() => ({ value: "admin" as string }));
vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ userProfile: { uid: "u1", role: role.value }, loading: false }),
}));
vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }) }));

import { AdminTopbar } from "./admin-topbar";

afterEach(cleanup);
beforeEach(() => {
  mockPathname = "/hoy";
  mockSearch = "";
  role.value = "admin";
  vi.clearAllMocks();
});

describe("topbar del Centro Comercial", () => {
  it("el buscador muestra el placeholder del mockup y abre ⌘K", () => {
    render(<AdminTopbar activeArea="hoy" />);
    const search = screen.getByRole("button", { name: /abrir buscador/i });
    expect(search).toHaveTextContent("Buscar clientes, conversaciones, cotizaciones...");
    expect(search).toHaveTextContent("⌘K");
    fireEvent.click(search);
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it("en /hoy muestra las 5 vistas y marca la activa", () => {
    mockSearch = "vista=cobros";
    render(<AdminTopbar activeArea="hoy" />);
    const nav = screen.getByRole("navigation", { name: /vistas de inicio/i });
    const links = Array.from(nav.querySelectorAll("a"));
    expect(links.map((a) => a.textContent)).toEqual(["Hoy", "Pendientes", "Cotizaciones", "Cobros", "Clientes activos"]);
    expect(screen.getByRole("link", { name: "Cobros" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Hoy" })).not.toHaveAttribute("aria-current");
  });

  it("fuera de /hoy no muestra las vistas", () => {
    mockPathname = "/clientes";
    render(<AdminTopbar activeArea="crm" />);
    expect(screen.queryByRole("navigation", { name: /vistas de inicio/i })).toBeNull();
  });

  it("usuario real con su rol, nunca «Carlos»", () => {
    render(<AdminTopbar activeArea="hoy" />);
    expect(screen.getByText("Miguel Robles")).toBeTruthy();
    expect(screen.getByText("Administrador")).toBeTruthy();
    expect(screen.queryByText(/carlos/i)).toBeNull();
    cleanup();
    role.value = "staff";
    render(<AdminTopbar activeArea="hoy" />);
    expect(screen.getByText("Staff")).toBeTruthy();
  });

  it("«Nueva cotización» abre el selector de cliente y lleva a su pestaña de cotizaciones", () => {
    render(<AdminTopbar activeArea="hoy" />);
    fireEvent.click(screen.getByRole("button", { name: /nueva cotización/i }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "DALK" }));
    expect(push).toHaveBeenCalledWith("/clientes/cli-2?tab=cotizaciones&nueva=1");
  });
});
