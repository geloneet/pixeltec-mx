// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

/**
 * WO-2026-00515 (D-7) + WO-2026-00519: «+ Nueva cotización» del topbar lleva a
 * `/clientes/[id]?tab=cotizaciones&nueva=<token>`; la pestaña abre el
 * formulario nuevo y el token se consume (sessionStorage) cuando el usuario
 * sale del formulario (cancelar/guardar), en `pagehide` (refresh/cierre) o al
 * desmontarse con otra URL (navegó a otra parte). Un remontaje en la MISMA URL
 * — el `AnimatePresence` del shell remonta la página al terminar la animación
 * de entrada — vuelve a mostrar el formulario. La URL nunca se toca: cambiarla
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

describe("CotizacionesTab ?nueva=<token>", () => {
  it("abre el formulario de cotización nueva", () => {
    at("tab=cotizaciones&nueva=k1");
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("no cambia la URL", () => {
    const replaceState = vi.spyOn(window.history, "replaceState");
    at("tab=cotizaciones&nueva=k2");
    render(<CotizacionesTab {...props} />);
    expect(replaceState).not.toHaveBeenCalled();
    replaceState.mockRestore();
  });

  it("remontaje en la MISMA URL (animación del shell / StrictMode) ⇒ el formulario sigue abierto", () => {
    at("tab=cotizaciones&nueva=k3");
    render(<CotizacionesTab {...props} />);
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("refresh (pagehide) ⇒ al volver a cargar, listado", () => {
    at("tab=cotizaciones&nueva=k4");
    render(<CotizacionesTab {...props} />);
    window.dispatchEvent(new Event("pagehide"));
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("navegar a otra parte y volver con atrás/adelante ⇒ listado", () => {
    at("tab=cotizaciones&nueva=k5");
    render(<CotizacionesTab {...props} />);
    window.history.pushState(null, "", "/hoy"); // la URL cambia antes de desmontar
    cleanup();
    at("tab=cotizaciones&nueva=k5"); // atrás
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("cancelar el formulario nuevo lo consume", () => {
    at("tab=cotizaciones&nueva=k6");
    render(<CotizacionesTab {...props} />);
    fireEvent.click(screen.getByText("Cancelar"));
    expect(screen.queryByTestId("quote-form")).toBeNull();
    cleanup();
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });

  it("un nuevo clic (token nuevo) vuelve a abrir el formulario", () => {
    at("tab=cotizaciones&nueva=k7");
    render(<CotizacionesTab {...props} />);
    window.dispatchEvent(new Event("pagehide"));
    cleanup();
    at("tab=cotizaciones&nueva=k8");
    render(<CotizacionesTab {...props} />);
    expect(screen.getByTestId("quote-form")).toHaveTextContent("nueva");
  });

  it("sin el parámetro muestra el listado", () => {
    at("tab=cotizaciones");
    render(<CotizacionesTab {...props} />);
    expect(screen.queryByTestId("quote-form")).toBeNull();
  });
});
