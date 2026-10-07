// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * WO-2026-00515 (D-7) + WO-2026-00519: «+ Nueva cotización» del topbar deja
 * una intención de un solo uso (sessionStorage, por cliente) y lleva a
 * `/clientes/[id]?tab=cotizaciones&nueva=1`. La pestaña abre el formulario
 * nuevo si la intención está pendiente, y la consume al salir del formulario
 * (cancelar/guardar), en `pagehide` (refresh/cierre) o al desmontarse con otra
 * URL (navegó a otra parte). Un remontaje en la MISMA URL — el
 * `AnimatePresence` del shell remonta la página al terminar la animación de
 * entrada — vuelve a mostrar el formulario. La URL nunca se toca: cambiarla
 * remonta la página en el App Router.
 */
let search = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search) }));
vi.mock("@/components/crm/workspace-tabs/quote-form", () => ({
  QuoteForm: ({ quote, onCancel }: { quote: unknown; onCancel: () => void }) => (
    <div data-testid="quote-form">
      {quote === null ? "nueva" : "editar"}
      <button type="button" onClick={onCancel}>Cancelar</button>
    </div>
  ),
}));
vi.mock("@/components/crm/workspace-tabs/quote-detail", () => ({ QuoteDetail: () => <div data-testid="quote-detail" /> }));

import { CotizacionesTab } from "@/components/crm/workspace-tabs/CotizacionesTab";
import { markNuevaIntent } from "./nueva-cotizacion-intent";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  window.history.pushState(null, "", "/");
  search = "";
});

/** Simula estar en esa URL (useSearchParams + window.location). */
function at(qs: string) {
  search = qs;
  window.history.pushState(null, "", `/clientes/cli-1${qs ? `?${qs}` : ""}`);
}

const props = {
  clientId: "cli-1",
  clientName: "DALK",
  clientEmail: null,
  clientPhone: null,
  quotes: [],
  siteUrl: "https://pixeltec.mx",
  onChanged: () => {},
};

/** Lo que hace el botón del topbar antes de navegar. */
const clickNueva = () => markNuevaIntent("cli-1", window.sessionStorage);

describe("CotizacionesTab ?nueva=1 + intención", () => {
  it("abre el formulario de cotización nueva", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("no cambia la URL", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("remontaje en la MISMA URL (animación del shell / StrictMode) ⇒ el formulario sigue abierto", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("refresh (pagehide) ⇒ al volver a cargar, listado", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    window.dispatchEvent(new Event("pagehide"));
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("navegar a otra parte y volver con atrás/adelante ⇒ listado", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    window.history.pushState(null, "", "/hoy"); // la URL cambia antes de desmontar
    cleanup();
    at("tab=cotizaciones&nueva=1"); // atrás
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("cancelar el formulario nuevo lo consume", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByTestId("quote-form")).toBeNull();
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("un nuevo clic vuelve a abrir el formulario", () => {
    clickNueva();
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    window.dispatchEvent(new Event("pagehide"));
    cleanup();
    clickNueva();
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("?nueva=1 sin intención (enlace pegado) ⇒ listado", () => {
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("intención de OTRO cliente ⇒ listado", () => {
    markNuevaIntent("cli-otro", window.sessionStorage);
    at("tab=cotizaciones&nueva=1");
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("sin el parámetro muestra el listado", () => {
    clickNueva();
    at("tab=cotizaciones");
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });
});
