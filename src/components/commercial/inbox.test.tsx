// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SWRConfig } from "swr";
import { CommercialInbox } from "./inbox";
import type { CommercialSnapshot } from "@/lib/commercial/snapshot";
const action = vi.hoisted(() => vi.fn());
vi.mock("./api", () => ({ commercialAction: action }));
afterEach(() => {
  cleanup();
  action.mockReset();
});
const now = "2026-10-13T18:00:00Z";
const conversation: CommercialSnapshot["conversations"][number] = {
  id: "conversation",
  ownerId: "owner",
  clientId: "client",
  opportunityId: null,
  channel: "email",
  externalId: "external",
  address: "ana@example.invalid",
  subject: "Consulta de sitio web",
  state: "humano",
  mode: "HUMAN",
  matchReview: false,
  revision: 0,
  lastInboundAt: now,
  updatedAt: now,
};
const data: CommercialSnapshot = {
  now,
  user: { id: "owner", name: "QA", role: "admin" },
  contacts: [
    {
      id: "client",
      publicId: "cliente",
      name: "Empresa",
      contactName: "Ana",
      email: "ana@example.invalid",
      phone: null,
      status: "activo",
      nextAction: null,
      portalEnabled: false,
    },
  ],
  opportunities: [],
  projects: [],
  quotes: [],
  conversations: [conversation],
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
function show(mode: "HUMAN" | "BOT" = "HUMAN", matchReview = false) {
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        revalidateOnMount: false,
        fallback: {
          "/api/commercial/conversations/conversation": {
            messages: [
              {
                id: "message",
                direction: "inbound",
                body: "Necesito asesoría",
                delivery: "received",
                createdAt: now,
              },
            ],
          },
        },
      }}
    >
      <CommercialInbox
        data={{
          ...data,
          conversations: [{ ...conversation, mode, matchReview }],
        }}
        refresh={vi.fn()}
      />
    </SWRConfig>,
  );
}
describe("Conversación con contexto y envío revisado", () => {
  it("muestra identidad, canal, asunto e historial sin enviar al abrir ni al revisar borrador", async () => {
    show();
    await screen.findByRole("textbox", { name: "Tu respuesta" });
    expect(
      screen.getByText("Consulta de sitio web", { selector: "strong" }),
    ).toBeVisible();
    expect(screen.getByText("Necesito asesoría")).toBeVisible();
    expect(screen.getByRole("link", { name: "Ver cliente" })).toHaveAttribute(
      "href",
      "/clientes/cliente",
    );
    expect(action).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Tu respuesta" }), {
      target: { value: "Borrador para revisión" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Revisar envío" }));
    expect(
      screen.getByRole("dialog", { name: "Confirmar respuesta" }),
    ).toBeVisible();
    expect(action).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Volver al borrador" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("textbox", { name: "Tu respuesta" })).toHaveValue(
      "Borrador para revisión",
    );
  });
  it("mantiene la frontera de atención humana antes de responder", async () => {
    show("BOT");
    await screen.findByRole("textbox", { name: "Tu respuesta" });
    fireEvent.change(screen.getByRole("textbox", { name: "Tu respuesta" }), {
      target: { value: "Respuesta" },
    });
    expect(
      screen.getByRole("button", { name: "Revisar envío" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Atención humana" }),
    ).toBeEnabled();
    expect(action).not.toHaveBeenCalled();
  });
  it("no permite escribir ni revisar el envío de un contacto dudoso", async () => {
    show("HUMAN", true);
    expect(
      await screen.findByRole("textbox", { name: "Tu respuesta" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Revisar envío" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Revisar y vincular contacto" }),
    ).toBeVisible();
  });
});
