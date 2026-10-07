// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * WO-2026-00515 (D-7) + WO-2026-00519: «+ Nueva cotización» del topbar lleva a
 * `/clientes/[id]?tab=cotizaciones&nueva=1`; con `nueva=1` la pestaña abre
 * directamente el formulario de cotización nueva y **consume** el parámetro
 * (lo quita de la URL con `history.replaceState`, sin tocar `tab`), para que
 * refresh/atrás/adelante no reabran el formulario indefinidamente.
 */
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/components/crm/workspace-tabs/quote-form", () => ({
  QuoteForm: ({ quote }: { quote: unknown }) => <div data-testid="quote-form">{quote === null ? "nueva" : "editar"}</div>,
}));
vi.mock("@/components/crm/workspace-tabs/quote-detail", () => ({ QuoteDetail: () => <div data-testid="quote-detail" /> }));

import { CotizacionesTab } from "@/components/crm/workspace-tabs/CotizacionesTab";

let replaceState: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  replaceState = vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  cleanup();
  replaceState.mockRestore();
  window.history.pushState(null, "", "/");
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

function at(qs: string) {
  search = qs;
  window.history.pushState(null, "", `/clientes/cli-1${qs ? `?${qs}` : ""}`);
}

describe("CotizacionesTab ?nueva=1", () => {
  it("abre el formulario de cotización nueva", () => {
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("consume nueva=1: la URL queda en ?tab=cotizaciones (sin nueva) y el formulario sigue abierto", () => {
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(replaceState).toHaveBeenCalledTimes(1);
    expect(replaceState.mock.calls[0][2]).toBe("/clientes/cli-1?tab=cotizaciones");
    expect(window.location.search).toBe("?tab=cotizaciones");
    expect(screen.getByTestId("quote-form")).toBeInTheDocument();
  });

  it("sin el parámetro muestra el listado y no toca la URL", () => {
    at("tab=cotizaciones");
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });

  it("si ya estaba montada en el listado, un nuevo ?nueva=1 abre el formulario", () => {
    at("tab=cotizaciones");
    const { rerender } = render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
    at("tab=cotizaciones&nueva=1");
    rerender(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
    expect(window.location.search).toBe("?tab=cotizaciones");
  });
});
