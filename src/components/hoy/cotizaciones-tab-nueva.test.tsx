// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * WO-2026-00515 (D-7): «+ Nueva cotización» del topbar lleva a
 * `/clientes/[id]?tab=cotizaciones&nueva=1`; con `nueva=1` la pestaña abre
 * directamente el formulario de cotización nueva.
 */
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/components/crm/workspace-tabs/quote-form", () => ({
  QuoteForm: ({ quote }: { quote: unknown }) => <div data-testid="quote-form">{quote === null ? "nueva" : "editar"}</div>,
}));
vi.mock("@/components/crm/workspace-tabs/quote-detail", () => ({ QuoteDetail: () => <div data-testid="quote-detail" /> }));

import { CotizacionesTab } from "@/components/crm/workspace-tabs/CotizacionesTab";

afterEach(() => {
  cleanup();
  search = "";
});

const props = {
  clientId: "cli-1",
  clientName: "DALK",
  clientEmail: null,
  clientPhone: null,
  quotes: [],
  siteUrl: "https://pixeltec.mx",
  onChanged: () => {},
};

describe("CotizacionesTab ?nueva=1", () => {
  it("abre el formulario de cotización nueva", () => {
    search = "tab=cotizaciones&nueva=1";
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("sin el parámetro muestra el listado", () => {
    search = "tab=cotizaciones";
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });
});
