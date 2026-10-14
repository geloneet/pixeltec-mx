// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";
import { computeBreakdown } from "@/lib/quotes/money";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { CommercialQuotes, filterQuotes, quoteIsExpiring } from "./quotes";
import { CommercialPage } from "./commercial-page";
vi.mock("@/lib/quotes/actions", () => ({ acceptQuote: vi.fn() }));
vi.mock("@/components/crm/workspace-tabs/quote-form", () => ({
  QuoteForm: () => null,
}));
vi.mock("@/components/crm/workspace-tabs/quote-document", () => ({
  QuoteDocument: () => null,
}));
vi.mock("@/components/hoy/nueva-cotizacion-button", () => ({
  NuevaCotizacionButton: () => <button>Nueva cotización</button>,
}));
afterEach(cleanup);
const now = "2026-10-13T18:00:00.000Z";
const contact = {
  id: "client",
  publicId: "cliente-publico",
  name: "Cliente de prueba",
  contactName: "Ana",
  email: "ana@example.invalid",
  phone: null,
  status: "prospecto" as const,
  nextAction: null,
  portalEnabled: false,
};
const data: CommercialSnapshot = {
  now,
  user: { id: "owner", name: "Responsable", role: "admin" },
  contacts: [contact],
  opportunities: [],
  projects: [],
  quotes: [],
  conversations: [],
  bills: [],
  reminders: [],
  policy: {
    automaticEnabled: false,
    tone: "cercano",
    approvedAnswers: [],
    revision: 0,
  },
  activity: [],
  outbox: [],
  decisions: [],
};
function quote(
  id: string,
  status = "enviada",
  validUntil = "2026-10-15T18:00:00Z",
): CommercialSnapshot["quotes"][number] {
  const items = [
    {
      description: "Sitio",
      quantity: 1,
      unitPriceCents: 100000,
      recurrence: "unica" as const,
    },
    {
      description: "Soporte",
      quantity: 1,
      unitPriceCents: 10000,
      recurrence: "mensual" as const,
    },
    {
      description: "Dominio",
      quantity: 1,
      unitPriceCents: 20000,
      recurrence: "anual" as const,
    },
  ];
  return {
    id,
    version: 2,
    clientId: "client",
    folio: "COT-" + id,
    title: "Proyecto " + id,
    items,
    taxEnabled: false,
    notes: "",
    validUntil,
    status,
    publicToken: "token",
    sentAt: now,
    createdAt: now,
    updatedAt: now,
    currency: "MXN",
    problem: "Problema",
    solution: "Solución",
    scopeIncluded: "Alcance de prueba",
    exclusions: "",
    estimatedDelivery: "Dos semanas",
    paymentTerms: { type: "50_50", custom: "" },
    acceptedAt: null,
    rejectedAt: null,
    nextFollowUpAt: null,
    rejection: null,
    totals: computeBreakdown(items, false),
  };
}
function showPage(
  view: Parameters<typeof CommercialPage>[0]["view"],
  fixture: CommercialSnapshot,
) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        fallback: { "/api/commercial": fixture },
        revalidateOnMount: false,
      }}
    >
      <CommercialPage view={view} />
    </SWRConfig>,
  );
}
describe("Operación resumida y detalle", () => {
  it("conserva las acciones del cliente dentro de su detalle y busca por correo", () => {
    showPage("clients", data);
    expect(screen.getByText("0 proyectos · 0 ventas abiertas")).toBeVisible();
    const row = screen.getByText("Cliente de prueba").closest("details")!;
    expect(row).not.toHaveAttribute("open");
    expect(
      within(row).getByRole("link", { name: /Ver cliente/, hidden: true }),
    ).toHaveAttribute("href", "/clientes/cliente-publico");
    fireEvent.click(row.querySelector("summary")!);
    expect(row).toHaveAttribute("open");
    expect(
      within(row).getByRole("button", { name: "Estado de cuenta" }),
    ).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "Nueva oportunidad" }),
    ).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar clientes" }), {
      target: { value: "ana@example.invalid" },
    });
    expect(screen.getByText("Cliente de prueba")).toBeVisible();
  });
  it("abre ventas resumidas en lista, conserva tablero y filtro de etapa", () => {
    const opportunity = {
      id: "sale",
      ownerId: "owner",
      clientId: "client",
      need: "Necesidad extensa",
      stage: "nuevo" as const,
      source: "manual" as const,
      assignedTo: "owner",
      quoteId: null,
      nextAction: "Llamar",
      nextActionDue: null,
      reason: "",
      revision: 0,
      createdAt: now,
      updatedAt: now,
    };
    showPage("sales", { ...data, opportunities: [opportunity] });
    expect(screen.getByRole("button", { name: "Ver tablero" })).toBeVisible();
    const row = screen.getByText("Cliente de prueba").closest("details")!;
    fireEvent.click(row.querySelector("summary")!);
    expect(
      within(row).getByRole("button", { name: /Ver venta/ }),
    ).toBeVisible();
    expect(
      within(row).getByRole("button", { name: "Crear cotización" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Ver tablero" }));
    fireEvent.click(screen.getByRole("button", { name: /En conversación/ }));
    expect(screen.queryByText("Cliente de prueba")).not.toBeInTheDocument();
  });
});
describe("Cotizaciones de trabajo", () => {
  it("deriva vencidas, conserva aceptadas y limita los próximos vencimientos", () => {
    const expired = quote("vencida", "enviada", "2026-10-12T18:00:00Z");
    const accepted = quote("aceptada", "aceptada", "2026-10-12T18:00:00Z");
    const soon = quote("próxima");
    const far = quote("futura", "enviada", "2026-11-15T18:00:00Z");
    const fixture = { ...data, quotes: [expired, accepted, soon, far] };
    expect(filterQuotes(fixture, "", "vencida").map((q) => q.id)).toEqual([
      "vencida",
    ]);
    expect(filterQuotes(fixture, "", "aceptada").map((q) => q.id)).toEqual([
      "aceptada",
    ]);
    expect(filterQuotes(fixture, "ANA", "all")).toHaveLength(0);
    expect(
      filterQuotes(fixture, "cliente de prueba", "expiring").map((q) => q.id),
    ).toEqual(["próxima"]);
    expect(quoteIsExpiring(far, now)).toBe(false);
  });
  it("filtra sin perder acceso al documento, versión ni frecuencias del importe", () => {
    const row = quote("QA");
    const onPreview = vi.fn();
    const onEdit = vi.fn();
    render(
      <CommercialQuotes
        data={{ ...data, quotes: [row] }}
        onPreview={onPreview}
        onEdit={onEdit}
        onDecision={vi.fn()}
      />,
    );
    expect(screen.getByText("Alcance · Alcance de prueba")).toBeVisible();
    fireEvent.click(screen.getByText("Proyecto QA").closest("summary")!);
    expect(screen.getByText("Mensual")).toBeVisible();
    expect(
      screen.getByText("Renovación anual · desde el primer aniversario"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: /Ver documento y compartir/ }),
    );
    expect(onPreview).toHaveBeenCalledWith(row);
    fireEvent.click(screen.getByRole("button", { name: "Editar / versionar" }));
    expect(onEdit).toHaveBeenCalledWith(row);
    expect(
      screen.getByRole("link", { name: "Ficha del cliente" }),
    ).toHaveAttribute("href", "/clientes/cliente-publico?tab=cotizaciones");
    fireEvent.change(
      screen.getByRole("textbox", { name: "Buscar cotizaciones" }),
      { target: { value: "no-existe" } },
    );
    expect(screen.getByText("Sin cotizaciones en esta vista")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar todas" }));
    expect(screen.getByText("Proyecto QA")).toBeVisible();
  });
});

describe("Proyectos y cobros en filas", () => {
  it("conserva avance, nota, siguiente paso y acciones del proyecto", () => {
    showPage("projects", {
      ...data,
      projects: [
        {
          id: "project",
          publicId: "public-project",
          clientId: "client",
          name: "Proyecto activo",
          stage: "revision",
          note: "Revisar entregable",
          nextStep: "Validar alcance",
          due: "2026-10-15",
          revision: 1,
        },
      ],
    });
    expect(
      screen.getByText("Nota al cliente · Revisar entregable"),
    ).toBeVisible();
    const row = screen.getByText("Proyecto activo").closest("details")!;
    fireEvent.click(row.querySelector("summary")!);
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(screen.getByText("Revisar entregable")).toBeVisible();
    for (const name of ["Actualizar avance", "Compartir avance", "Historial"])
      expect(within(row).getByRole("button", { name })).toBeVisible();
    expect(
      within(row).getByRole("link", { name: /Trabajo interno/ }),
    ).toHaveAttribute("href", "/proyectos/public-project");
  });
  it("mantiene saldo parcial correcto, distingue pagados y conserva registrar pago", () => {
    const bill: CommercialSnapshot["bills"][number] = {
      id: "bill",
      clientId: "client",
      clientName: contact.name,
      concept: "Anticipo",
      amount: 1000,
      currency: "MXN",
      frequency: "unico",
      status: "parcial",
      dueDate: "2026-10-15",
      createdAt: now,
      updatedAt: now,
      paymentHistory: [
        {
          id: "payment",
          billingItemId: "bill",
          amount: 300,
          method: "transferencia",
          paidAt: now,
          periodKey: "2026-10-15",
          createdAt: now,
        },
      ],
    };
    showPage("billing", {
      ...data,
      bills: [
        bill,
        { ...bill, id: "paid", concept: "Servicio pagado", status: "pagado" },
      ],
    });
    const row = screen.getByText("Anticipo").closest("details")!;
    expect(
      within(row.querySelector("summary")!).getByText("$700.00 MXN"),
    ).toBeVisible();
    fireEvent.click(row.querySelector("summary")!);
    for (const name of ["Registrar pago", "Estado de cuenta", "Recordatorio"])
      expect(within(row).getByRole("button", { name })).toBeVisible();
    fireEvent.click(screen.getByRole("tab", { name: "Pagados" }));
    expect(screen.queryByText("Anticipo")).not.toBeInTheDocument();
    const paid = screen.getByText("Servicio pagado").closest("details")!;
    expect(
      within(paid.querySelector("summary")!).getByText("$1,000.00 MXN"),
    ).toBeVisible();
    expect(
      within(paid).queryByRole("button", {
        name: "Registrar pago",
        hidden: true,
      }),
    ).not.toBeInTheDocument();
  });
});

it("filtra proyectos por etapas confirmadas y conserva los que aún no tienen etapa", () => {
  showPage("projects", {
    ...data,
    projects: [
      {
        id: "p1",
        publicId: null,
        clientId: "client",
        name: "Proyecto confirmado",
        stage: "revision",
        revision: 1,
        note: "",
        nextStep: "Revisar",
        due: null,
      },
      {
        id: "p2",
        publicId: null,
        clientId: "client",
        name: "Proyecto sin confirmar",
        stage: "arranque",
        revision: 0,
        note: "",
        nextStep: "",
        due: null,
      },
    ],
  });
  expect(screen.getByText("Proyecto sin confirmar")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /1 Listo para revisar/ }));
  expect(screen.getByText("Proyecto confirmado")).toBeVisible();
  expect(screen.queryByText("Proyecto sin confirmar")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /1 Por confirmar/ }));
  expect(screen.getByText("Proyecto sin confirmar")).toBeVisible();
  expect(screen.queryByText("Proyecto confirmado")).not.toBeInTheDocument();
});
