// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CommercialNavigation } from "./commercial-navigation";
import { getPrimaryNavAreas, getMoreNavAreas, getAreaHref, NAV_AREA_LABELS } from "@/components/nav/nav-config";
afterEach(cleanup);
describe("Menú comercial agrupado sin ampliar visibilidad", () => {
  it.each(["admin", "staff"])("conserva cada destino del catálogo una vez para %s y la selección", (role) => {
    render(<CommercialNavigation role={role} activeArea="ventas" />);
    const areas = [...getPrimaryNavAreas(role), ...getMoreNavAreas(role)];
    expect(screen.getAllByRole("link")).toHaveLength(areas.length);
    for (const area of areas) {
      expect(screen.getByRole("link", { name: NAV_AREA_LABELS[area] })).toHaveAttribute("href", getAreaHref(area));
    }
    expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute("aria-current", "page");
    const group = screen.getByText("Operación").closest("details")!;
    expect(group).toHaveAttribute("open");
    expect(screen.getByRole("link", { name: "Cotizaciones" })).toBeVisible();
    fireEvent.click(group.querySelector("summary")!);
    expect(screen.getByRole("link", { name: "Cotizaciones" })).not.toBeVisible();
    fireEvent.click(group.querySelector("summary")!);
    expect(screen.getByRole("link", { name: "Cotizaciones" })).toBeVisible();
  });
  it.each(["meta-reviewer", "unknown"])("el rol restringido %s conserva el catálogo vacío sin controles administrativos", (role) => {
    render(<CommercialNavigation role={role} activeArea="whatsapp" />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText("Operación")).not.toBeInTheDocument();
    expect(screen.queryByText("General")).not.toBeInTheDocument();
    expect(screen.queryByText("Más herramientas")).not.toBeInTheDocument();
  });
});
