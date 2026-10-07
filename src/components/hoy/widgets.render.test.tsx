// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/hoy",
  useSearchParams: () => new URLSearchParams(),
}));

import { deriveDashboard } from "@/lib/hoy/dashboard-derive";
import { emptySnapshot, fullSnapshot } from "@/lib/hoy/__tests__/fixtures";
import { KpiRow } from "./kpi-card";
import { PrioritiesPanel } from "./priorities-panel";
import { ChecklistPanel } from "./checklist-panel";
import { CobrosPanel } from "./cobros-panel";
import { AlertsPanel } from "./alerts-panel";
import { PipelineBoard } from "./pipeline-board";
import { ActivityFeed } from "./activity-feed";
import { HoyHeader } from "./hoy-header";

afterEach(cleanup);

const full = deriveDashboard(fullSnapshot(), { vista: "hoy", actividad: "todas", greetingName: "Miguel" });
const empty = deriveDashboard(emptySnapshot(), { vista: "hoy", actividad: "todas", greetingName: null });

function Board({ d, theme }: { d: typeof full; theme: "light" | "dark crm" }) {
  return (
    <div className={theme}>
      <HoyHeader name={d.greetingName} dateLabel={d.dateLabel} />
      <KpiRow result={d.kpis} />
      <PrioritiesPanel result={d.prioridades} title="Prioridades de hoy" nowIso={d.nowIso} />
      <ChecklistPanel result={d.checklist} nowIso={d.nowIso} />
      <CobrosPanel result={d.cobros} />
      <AlertsPanel result={d.alertas} nowIso={d.nowIso} />
      <PipelineBoard result={d.pipeline} />
      <ActivityFeed result={d.actividad} nowIso={d.nowIso} filter="todas" />
    </div>
  );
}

describe.each(["light", "dark crm"] as const)("tablero completo (%s)", (theme) => {
  it("estructura del mockup con datos reales derivados", () => {
    const { container } = render(<Board d={full} theme={theme} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¡Hola, Miguel!");
    expect(screen.getByText("Aquí está el panorama de tu negocio hoy.")).toBeTruthy();
    expect(screen.getByText("Martes, 6 de octubre de 2026")).toBeTruthy();
    for (const h of ["Prioridades de hoy", "Hoy debes hacer esto", "Cobros y pagos", "Alertas", "Pipeline comercial", "Actividad reciente"]) {
      expect(screen.getByRole("heading", { level: 2, name: h }), h).toBeTruthy();
    }
    for (const k of ["Leads nuevos", "Seguimientos hoy", "Cotizaciones pendientes", "Cobros por vencer", "Cobrado este mes"]) {
      expect(screen.getByText(k), k).toBeTruthy();
    }
    expect(container.textContent).not.toMatch(/NaN|undefined|null/);
  });

  it("prioridades: fila con canal, estado, monto, siguiente acción y CTA", () => {
    render(<Board d={full} theme={theme} />);
    const panel = screen.getByRole("region", { name: "Prioridades de hoy" });
    const smile = within(panel).getByText("Smile More Dental").closest("li")!;
    expect(within(smile).getByText("WhatsApp")).toBeTruthy();
    expect(within(smile).getByText("Cotización enviada")).toBeTruthy();
    expect(within(smile).getByText("$48,000 MXN")).toBeTruthy();
    expect(within(smile).getByRole("link", { name: "Ver conversación" })).toHaveAttribute("href", "/whatsapp");
    expect(within(smile).getByRole("button", { name: /más acciones para smile more dental/i })).toBeTruthy();
  });

  it("checklist de solo lectura con progreso accesible", () => {
    render(<Board d={full} theme={theme} />);
    const panel = screen.getByRole("region", { name: "Hoy debes hacer esto" });
    expect(within(panel).getByText("1/4")).toBeTruthy();
    const bar = within(panel).getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    const boxes = within(panel).getAllByRole("checkbox");
    expect(boxes).toHaveLength(4);
    for (const b of boxes) expect(b).toHaveAttribute("aria-disabled", "true");
    expect(boxes.filter((b) => b.getAttribute("aria-checked") === "true")).toHaveLength(1);
  });

  it("kanban accesible: listas por etapa con conteo", () => {
    render(<Board d={full} theme={theme} />);
    expect(screen.getByRole("list", { name: "Etapa Nuevo lead, 2 oportunidades" })).toBeTruthy();
    expect(screen.getByText("11 oportunidades")).toBeTruthy();
  });

  it("cobros con chip de urgencia en texto", () => {
    render(<Board d={full} theme={theme} />);
    const panel = screen.getByRole("region", { name: "Cobros y pagos" });
    expect(within(panel).getByText("Vence hoy")).toBeTruthy();
    expect(within(panel).getByText("Vence en 2 días")).toBeTruthy();
  });
});

describe("KPI legibles a 1024–1440 (fase 2)", () => {
  it("etiquetas y comparaciones del delta no se recortan con ellipsis", () => {
    render(<KpiRow result={full.kpis} />);
    for (const label of ["Cotizaciones pendientes", "Seguimientos hoy", "Cobros por vencer", "Cobrado este mes"]) {
      const el = screen.getByText(label);
      expect(el.className, label).not.toMatch(/\btruncate\b|line-clamp/);
    }
    for (const cmp of ["programados vs. ayer", "vs. semana pasada", "vs. mes anterior"]) {
      const el = screen.getByText(cmp);
      expect(el.className, cmp).not.toMatch(/\btruncate\b/);
    }
  });
});

describe("BD vacía: estados vacíos honestos", () => {
  it("sin cifras inventadas ni NaN", () => {
    const { container } = render(<Board d={empty} theme="light" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("¡Hola!");
    expect(screen.getByText("Sin prioridades por ahora.")).toBeTruthy();
    expect(screen.getByText("Nada pendiente para hoy.")).toBeTruthy();
    expect(screen.getByText("Sin cobros pendientes.")).toBeTruthy();
    expect(screen.getByText("Sin alertas.")).toBeTruthy();
    expect(screen.getByText("Aún no hay actividad.")).toBeTruthy();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });
});

describe("widget caído", () => {
  it("muestra «No se pudo cargar» con Reintentar y no tumba el resto", () => {
    const d = { ...full, cobros: { ok: false as const, error: "x" } };
    render(<Board d={d} theme="light" />);
    const panel = screen.getByRole("region", { name: "Cobros y pagos" });
    expect(within(panel).getByText(/no se pudo cargar/i)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: /reintentar/i })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Alertas" })).toBeTruthy();
  });

  it("KPI sin dato muestra «Sin datos», no «$0»", () => {
    const snap = fullSnapshot();
    snap.payments = { ok: false, error: "x" };
    const d = deriveDashboard(snap, { vista: "hoy", actividad: "todas", greetingName: null });
    render(<KpiRow result={d.kpis} />);
    const tile = screen.getByText("Cobrado este mes").closest("[data-kpi]")!;
    expect(within(tile as HTMLElement).getByText("Sin datos")).toBeTruthy();
    expect(tile.textContent).not.toContain("$0");
  });
});

describe("Actividad · cotizaciones (WO-2026-00519)", () => {
  const row = (over: Partial<import("@/lib/hoy/types").ActivityRow>) => ({
    id: "q:1:cotizacion_aceptada",
    kind: "cotizacion" as const,
    title: "Cotización aceptada por DALK",
    subtitle: "COT-2026-0100 · Tienda",
    at: "2026-10-05T18:00:00.000Z",
    href: "/clientes/dalk?tab=cotizaciones",
    ...over,
  });

  it("muestra el importe real en su propia línea y la fecha real como <time>", () => {
    render(<ActivityFeed result={{ ok: true, data: [row({ amount: "$48,000.00 MXN" })] }} nowIso="2026-10-06T18:00:00.000Z" filter="cotizaciones" />);
    expect(screen.getByText("$48,000.00 MXN")).toBeInTheDocument();
    const time = screen.getByText("Hace 1 día").closest("time");
    expect(time).toHaveAttribute("datetime", "2026-10-05T18:00:00.000Z");
  });

  it("sin importe no pinta línea de importe (ni «$0»)", () => {
    const { container } = render(
      <ActivityFeed result={{ ok: true, data: [row({ amount: null })] }} nowIso="2026-10-06T18:00:00.000Z" filter="cotizaciones" />,
    );
    expect(container.textContent).not.toMatch(/\$0|NaN|undefined/);
  });

  it("filtro de cotizaciones vacío ⇒ estado vacío honesto", () => {
    render(<ActivityFeed result={{ ok: true, data: [] }} nowIso="2026-10-06T18:00:00.000Z" filter="cotizaciones" />);
    expect(screen.getByText("Aún no hay cotizaciones enviadas, aceptadas ni rechazadas.")).toBeInTheDocument();
  });
});
