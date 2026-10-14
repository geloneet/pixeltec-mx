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
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
import { deriveDashboard } from "@/lib/hoy/dashboard-derive";
import { emptySnapshot, fullSnapshot } from "@/lib/hoy/__tests__/fixtures";
import { CommercialHome } from "./home";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const empty: CommercialSnapshot = {
  now: "2026-10-13T04:00:00Z",
  user: { id: "owner", name: "QA", role: "admin" },
  contacts: [],
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
function conversation(
  id: string,
  channel: "email" | "whatsapp",
  date: string,
): CommercialSnapshot["conversations"][number] {
  return {
    id,
    channel,
    ownerId: "owner",
    clientId: null,
    opportunityId: null,
    externalId: id,
    address: id + "@example.invalid",
    subject: "Asunto " + id,
    state: "sin_atender",
    mode: "HUMAN",
    matchReview: false,
    revision: 0,
    lastInboundAt: date,
    updatedAt: date,
  };
}
function show(data = empty, pending: CommercialSnapshot["opportunities"] = []) {
  const onOpportunity = vi.fn(),
    onPayment = vi.fn(),
    onDecision = vi.fn();
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <CommercialHome
        data={data}
        pending={pending}
        decisions={[]}
        onOpportunity={onOpportunity}
        onDecision={onDecision}
        onPayment={onPayment}
      />
    </SWRConfig>,
  );
  return { onOpportunity, onPayment, onDecision };
}
describe("Inicio comercial", () => {
  it("conserva los cinco indicadores y Actividad reciente con filtros", () => {
    show();
    for (const label of [
      "Leads nuevos",
      "Seguimientos hoy",
      "Cotizaciones pendientes",
      "Cobros por vencer",
      "Cobrado este mes",
    ])
      expect(screen.getByText(label)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Actividad reciente" }),
    ).toBeVisible();
    for (const label of [
      "Todas",
      "WhatsApp",
      "Correo",
      "Cotizaciones",
      "Cobros",
    ])
      expect(
        within(
          screen.getByRole("navigation", { name: "Filtrar actividad" }),
        ).getByRole("button", { name: label }),
      ).toBeVisible();
  });
  it("filtra la actividad localmente sin perder la bandeja o prioridades", () => {
    const overview = deriveDashboard(fullSnapshot(), {
      vista: "hoy",
      actividad: "todas",
      greetingName: null,
    });
    render(
      <CommercialHome
        data={empty}
        pending={[]}
        decisions={[]}
        overview={overview}
        onOpportunity={vi.fn()}
        onDecision={vi.fn()}
        onPayment={vi.fn()}
      />,
    );
    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "Filtrar actividad" }),
      ).getByRole("button", { name: "Cobros" }),
    );
    expect(screen.getAllByText(/Pago recibido de/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Nuevo lead:/)).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Bandeja de entrada" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: /^Prioridades/ })).toBeVisible();
  });
  it("filtra canales y abre el hilo exacto, sin enviar ni marcar mensajes", async () => {
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => ({
      ok: true,
      json: async () => ({
        messages: [
          {
            id: "m",
            direction: "inbound",
            body: url.endsWith("wa") ? "Mensaje WhatsApp" : "Mensaje correo",
            createdAt: "2026-10-12T21:00:00Z",
            delivery: "received",
          },
        ],
      }),
    }));
    vi.stubGlobal("fetch", fetcher);
    show({
      ...empty,
      conversations: [
        conversation("mail", "email", "2026-10-11"),
        conversation("wa", "whatsapp", "2026-10-12"),
      ],
    });
    expect(await screen.findByText("Mensaje correo")).toBeVisible();
    expect(screen.getByText("Mensaje WhatsApp").closest("a")).toHaveAttribute(
      "href",
      "/whatsapp?conversation=wa",
    );
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Canal de la bandeja" }),
      ).getByRole("button", { name: /Correo/ }),
    );
    expect(screen.queryByText("Mensaje WhatsApp")).toBeNull();
    expect(screen.getByText("Mensaje correo")).toBeVisible();
    expect(
      fetcher.mock.calls.every(
        ([, options]) => !options || !("method" in options),
      ),
    ).toBe(true);
  });
  it("muestra fallo de un canal sin ocultar los mensajes del otro", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: !url.endsWith("wa"),
        json: async () =>
          url.endsWith("wa")
            ? { error: "offline" }
            : {
                messages: [
                  {
                    id: "m",
                    direction: "inbound",
                    body: "Correo disponible",
                    createdAt: "2026-10-12T21:00:00Z",
                  },
                ],
              },
      })),
    );
    show({
      ...empty,
      conversations: [
        conversation("mail", "email", "2026-10-11"),
        conversation("wa", "whatsapp", "2026-10-12"),
      ],
    });
    expect(await screen.findByText(/Vista previa no disponible/)).toBeVisible();
    expect(await screen.findByText("Correo disponible")).toBeVisible();
  });
  it("conserva el nombre completo y abre la oportunidad seleccionada", () => {
    const opportunity = {
      id: "sale",
      clientId: "client",
      stage: "cotizacion",
      need: "Un sitio de ventas",
      nextAction: "Revisar propuesta",
      nextActionDue: null,
    } as CommercialSnapshot["opportunities"][number];
    const contact = {
      id: "client",
      name: "Empresa con un nombre comercial extenso que debe poder leerse completo",
    } as CommercialSnapshot["contacts"][number];
    const { onOpportunity } = show({ ...empty, contacts: [contact] }, [
      opportunity,
    ]);
    expect(
      screen.getByText("Cotización", { selector: ".cc-pipeline-label" }),
    ).toBeVisible();
    expect(screen.getByText("Un sitio de ventas")).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", {
        name: /Empresa con un nombre comercial extenso/,
      }),
    );
    expect(onOpportunity).toHaveBeenCalledWith(opportunity);
    const stage = screen
      .getByText("Cotización", { selector: ".cc-pipeline-label" })
      .closest("details")!;
    expect(stage).toHaveAttribute("open");
    fireEvent.click(stage.querySelector("summary")!);
    expect(
      within(stage).getByRole("button", {
        name: /Empresa con un nombre comercial extenso/,
      }),
    ).not.toBeVisible();
    fireEvent.click(stage.querySelector("summary")!);
    expect(
      within(stage).getByRole("button", {
        name: /Empresa con un nombre comercial extenso/,
      }),
    ).toBeVisible();
  });
  it("muestra dos previews por defecto y permite abrir el resto sin perder acciones", () => {
    const rows = Array.from(
      { length: 5 },
      (_, i) =>
        ({
          id: "sale-" + i,
          clientId: "client-" + i,
          stage: "nuevo",
          need: "Necesidad " + i,
          nextAction: "Próximo paso " + i,
          nextActionDue: null,
        }) as CommercialSnapshot["opportunities"][number],
    );
    const contacts = rows.map(
      (o, i) =>
        ({
          id: o.clientId,
          name: "Cliente " + i,
        }) as CommercialSnapshot["contacts"][number],
    );
    const { onOpportunity } = show({ ...empty, contacts }, rows);
    const pipeline = screen.getByRole("region", { name: "Pipeline comercial" });
    expect(
      within(pipeline).getByRole("button", { name: /Cliente 0/ }),
    ).toBeVisible();
    expect(
      within(pipeline).getByRole("button", { name: /Cliente 4/ }),
    ).not.toBeVisible();
    fireEvent.click(within(pipeline).getByText("Ver 3 más"));
    fireEvent.click(
      within(pipeline).getByRole("button", { name: /Cliente 4/ }),
    );
    expect(onOpportunity).toHaveBeenCalledWith(rows[4]);
  });
  it("no inventa conversaciones o prioridades para una cartera vacía", () => {
    show();
    expect(screen.getByText("Tu bandeja está vacía")).toBeVisible();
    expect(screen.getByText("Sin pendientes para hoy")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Registrar pago" })).toBeNull();
  });
});
