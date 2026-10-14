// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { HomeTrend } from "./home-trend";
import { deriveDashboard } from "@/lib/hoy/dashboard-derive";
import { fullSnapshot, emptySnapshot } from "@/lib/hoy/__tests__/fixtures";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
afterEach(cleanup);
const data = {
  now: "2026-10-13T18:00:00Z",
  opportunities: [],
  contacts: [],
  quotes: [],
} as unknown as CommercialSnapshot;
function overview(empty = false) {
  return deriveDashboard(empty ? emptySnapshot() : fullSnapshot(), {
    vista: "hoy",
    actividad: "todas",
    greetingName: "QA",
  });
}
describe("Gráfica comercial con datos canónicos", () => {
  it("muestra los mismos registros diarios del indicador y permite seleccionar día y serie", () => {
    const o = overview();
    if (!o.kpis.ok) throw new Error("fixture_kpis_required");
    const follows = o.kpis.data.find((c) => c.id === "seguimientos")!;
    render(<HomeTrend overview={o} data={data} />);
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      `Últimos 7 días (seguimientos programados por día): ${follows.series.join(", ")}`,
    );
    const region = screen.getByRole("region", {
      name: "Actividad de la semana",
    });
    const days = within(region)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-label")?.includes("registros"));
    fireEvent.click(days[0]);
    expect(days[0]).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Leads" }));
    expect(screen.getByRole("img")).toHaveAttribute(
      "aria-label",
      o.kpis.data.find((c) => c.id === "leads")!.seriesLabel,
    );
  });
  it("conserva ceros reales sin inventar una curva de actividad", () => {
    render(<HomeTrend overview={overview(true)} data={data} />);
    expect(
      screen.getByText(
        "Sin registros de esta serie en los últimos siete días.",
      ),
    ).toBeVisible();
    expect(screen.getByRole("img").getAttribute("aria-label")).toContain(
      "0, 0, 0, 0, 0, 0, 0",
    );
  });
  it("distingue indisponibilidad de carga y no fabrica valores en un fallo", () => {
    render(<HomeTrend data={data} error />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Esta serie no está disponible. Revisa sus datos desde el detalle.",
      ),
    ).toBeVisible();
    expect(screen.queryByText("Cargando actividad…")).not.toBeInTheDocument();
  });
});
