/**
 * Fixtures SOLO de pruebas (no se importan desde código de producción).
 * «Ahora» = martes 2026-10-06 12:00 en CDMX (18:00 UTC).
 */
import type { HoySnapshot, SnapClient } from "../snapshot";

export const NOW = new Date("2026-10-06T18:00:00Z");

const ok = <T,>(data: T) => ({ ok: true as const, data });

export function client(over: Partial<SnapClient> & { pgId: string; name: string }): SnapClient {
  return {
    publicId: over.pgId,
    logoUrl: null,
    color: null,
    crmStatus: "prospecto",
    nextAction: null,
    phones: [],
    ...over,
  };
}

export function fullSnapshot(): HoySnapshot {
  return {
    now: NOW,
    clients: ok([
      client({ pgId: "c-smile", name: "Smile More Dental", phones: ["5213221234567"], crmStatus: "activo" }),
      client({
        pgId: "c-velank",
        name: "Velank Boutique",
        nextAction: { label: "Enviar propuesta actualizada", dueAt: "2026-10-06T18:30:00Z" },
      }),
      client({ pgId: "c-dalk", name: "DALK", crmStatus: "activo" }),
      client({ pgId: "c-pixelstate", name: "PixelState" }),
      client({ pgId: "c-nuevo", name: "Prospecto Nuevo" }),
    ]),
    quotes: ok([
      {
        id: "q-smile",
        clientPgId: "c-smile",
        folio: "COT-2026-0001",
        title: "Sitio web",
        status: "enviada",
        totalCents: 4_800_000,
        currency: "MXN",
        sentAt: "2026-10-05T17:00:00Z",
        acceptedAt: null,
        rejectedAt: null,
        nextFollowUpAt: "2026-10-08T17:00:00Z",
      },
      {
        id: "q-pixelstate",
        clientPgId: "c-pixelstate",
        folio: "COT-2026-0002",
        title: "Portal inmobiliario",
        status: "enviada",
        totalCents: 9_200_000,
        currency: "MXN",
        sentAt: "2026-09-28T17:00:00Z",
        acceptedAt: null,
        rejectedAt: null,
        nextFollowUpAt: "2026-10-05T16:00:00Z",
      },
      {
        id: "q-borrador",
        clientPgId: "c-velank",
        folio: "COT-2026-0003",
        title: "Inventario",
        status: "lista",
        totalCents: 7_320_000,
        currency: "MXN",
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        nextFollowUpAt: null,
      },
    ]),
    sales: ok([
      {
        id: "s-cerrada",
        clientPgId: "c-dalk",
        status: "activa",
        title: "Plan empresarial",
        acceptedAt: "2026-10-01T17:00:00Z",
        totalCents: 15_600_000,
        currency: "MXN",
      },
    ]),
    billing: ok([
      { id: "b-dalk", clientPgId: "c-dalk", concept: "Anticipo", amount: 156000, currency: "MXN", status: "pendiente", dueDate: "2026-10-06" },
      { id: "b-smile", clientPgId: "c-smile", concept: "Mensualidad", amount: 8000, currency: "MXN", status: "pendiente", dueDate: "2026-10-08" },
      { id: "b-vencido", clientPgId: "c-pixelstate", concept: "Hosting", amount: 1200, currency: "MXN", status: "vencido", dueDate: "2026-10-01" },
      { id: "b-pagado", clientPgId: "c-dalk", concept: "Dominio", amount: 500, currency: "MXN", status: "pagado", dueDate: "2026-10-03" },
    ]),
    payments: ok([
      { id: "p1", billingItemId: "b-pagado", clientPgId: "c-dalk", amount: 500, currency: "MXN", paidAt: "2026-10-06", createdAt: "2026-10-06T15:00:00Z" },
      { id: "p2", billingItemId: "b-x", clientPgId: "c-smile", amount: 10000, currency: "MXN", paidAt: "2026-10-02", createdAt: "2026-10-02T15:00:00Z" },
      { id: "p3", billingItemId: "b-y", clientPgId: "c-smile", amount: 4000, currency: "MXN", paidAt: "2026-09-20", createdAt: "2026-09-20T15:00:00Z" },
    ]),
    leads: ok([
      { id: "l1", name: "Clínica Vital", status: "new", createdAt: "2026-10-06T15:00:00Z", wantsContact: true, wantsContactAt: "2026-10-06T15:05:00Z", clientPgId: null },
      { id: "l2", name: "Grupo López", status: "new", createdAt: "2026-10-05T15:00:00Z", wantsContact: false, wantsContactAt: null, clientPgId: null },
      { id: "l3", name: "Restaurante Terra", status: "contacted", createdAt: "2026-10-01T15:00:00Z", wantsContact: false, wantsContactAt: null, clientPgId: null },
    ]),
    activity: ok([
      { id: "a1", clientPgId: "c-velank", type: "seguimiento", message: "Llamada de seguimiento", createdAt: "2026-10-06T16:00:00Z" },
    ]),
    notifications: ok([]),
    conversations: {
      status: "ok",
      items: [
        {
          phone: "5213221234567",
          clientPgId: "c-smile",
          lastMessageAt: "2026-10-06T17:35:00Z",
          preview: "Hola, ¿me compartes la propuesta?",
          direction: "inbound",
          unread: 2,
        },
      ],
    },
  };
}

export function emptySnapshot(): HoySnapshot {
  return {
    now: NOW,
    clients: ok([]),
    quotes: ok([]),
    sales: ok([]),
    billing: ok([]),
    payments: ok([]),
    leads: ok([]),
    activity: ok([]),
    notifications: ok([]),
    conversations: { status: "unavailable", items: [] },
  };
}
