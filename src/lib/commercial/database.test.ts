/** Postgres real aislado. Transportes controlados: no certifica proveedores externos. */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { config } from "dotenv";
const identity = vi.hoisted(() => ({ id: "", role: "admin" as string | null }));
const transport = vi.hoisted(() => ({ send: vi.fn(), pixelbot: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  requireUserSession: async () =>
    identity.role
      ? {
          userId: identity.id,
          role: identity.role,
          email: "qa@example.invalid",
        }
      : null,
  getSessionUserId: async () => (identity.role ? identity.id : null),
}));
vi.mock("@/lib/auth-guards", () => ({
  requireAdmin: async () =>
    identity.role === "admin"
      ? { ok: true, uid: identity.id, isAdmin: true }
      : { ok: false, status: 403, error: "forbidden" },
}));
vi.mock("@/lib/email", () => ({
  sendEmail: transport.send,
  verifyCommercialEmailDomain: async () => ({
    verified: false,
    reason: "Transporte controlado",
  }),
}));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({
  fetchPixelbot: transport.pixelbot,
}));
vi.mock("@/lib/documents/invoices", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/documents/invoices")>()),
  deliverInvoiceEmail: vi.fn(),
}));
const enabled = process.env.COMMERCIAL_DB_TESTS === "1";
if (enabled) config({ path: ".env.local" });
let db: (typeof import("@/lib/db"))["db"];
let schema: typeof import("@/lib/db/schema");
let inbound: typeof import("./inbound");
let ops: typeof import("./operations");
let inbox: typeof import("./inbox");
let reminders: typeof import("./reminders");
let payment: typeof import("./payments");
let decisions: typeof import("./quote-decisions");
let quotes: typeof import("@/lib/quotes/actions");
let snapshot: typeof import("./snapshot");
let owner: string;
let other: string;
let clientId: string;
let conversationId: string;
let quoteId: string;
let quoteToken: string;
let billId: string;
describe.runIf(enabled)("Centro Comercial en Postgres QA real", () => {
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL || "");
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/centro_qa"
    )
      throw new Error("DB tests require isolated centro_qa");
    ({ db } = await import("@/lib/db"));
    schema = await import("@/lib/db/schema");
    inbound = await import("./inbound");
    ops = await import("./operations");
    inbox = await import("./inbox");
    reminders = await import("./reminders");
    payment = await import("./payments");
    decisions = await import("./quote-decisions");
    quotes = await import("@/lib/quotes/actions");
    snapshot = await import("./snapshot");
    owner = randomUUID();
    other = randomUUID();
    identity.id = owner;
    await db.insert(schema.users).values([
      {
        id: owner,
        email: owner + "@example.invalid",
        role: "admin",
        status: "active",
        passwordHash: "!qa-no-login",
        name: "QA integración",
      },
      {
        id: other,
        email: other + "@example.invalid",
        role: "admin",
        status: "active",
        passwordHash: "!qa-no-login",
        name: "Otra cartera QA",
      },
    ]);
    process.env.COMMERCIAL_OWNER_ID = owner;
    process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE = "true";
    process.env.EGRESS_EMAIL_MODE = "allowlist";
    process.env.EGRESS_EMAIL_ALLOWLIST = "lead-qa@example.invalid";
    process.env.EGRESS_ALLOW_LIVE_OUTSIDE_PRODUCTION = "true";
    transport.send.mockImplementation(async () => ({
      success: true,
      id: randomUUID(),
    }));
  }, 30000);
  afterAll(() => {
    identity.role = "admin";
    vi.unstubAllEnvs();
  });
  it("ingreso repetido crea una sola oportunidad y un historial persistente", async () => {
    const input = {
      channel: "email",
      externalId: "lead-qa@example.invalid",
      address: "lead-qa@example.invalid",
      name: "Interés controlado",
      providerId: randomUUID(),
      body: "Quiero un sitio",
      subject: "Sitio",
      identifierVerified: false,
      receivedAt: new Date(),
    };
    const [a, b] = await Promise.all([
      inbound.ingestCommercialInbound(owner, input),
      inbound.ingestCommercialInbound(owner, input),
    ]);
    expect(a.conversation?.id).toBe(b.conversation?.id);
    expect([a.repeated, b.repeated].sort()).toEqual([false, true]);
    clientId = a.conversation!.clientId!;
    conversationId = a.conversation!.id;
    expect(
      (
        await db
          .select()
          .from(schema.commercialOpportunities)
          .where(eq(schema.commercialOpportunities.clientId, clientId))
      ).length,
    ).toBe(1);
    expect((await inbox.getCommercialThread(conversationId)).length).toBe(1);
    await expect(
      inbound.ingestCommercialInbound(owner, {
        ...input,
        body: "Contenido cambiado",
      }),
    ).rejects.toThrow("cambió");
  });
  it("coincidencia dudosa exige revisión y vínculo confirmado", async () => {
    const created = await ops.createCommercialContact({
      name: "Cliente existente QA",
      email: "match-qa@example.invalid",
      need: "Sistema",
      source: "manual",
    });
    expect(created.needsReview).toBe(false);
    const result = await inbound.ingestCommercialInbound(owner, {
      channel: "email",
      externalId: "match-qa@example.invalid",
      address: "match-qa@example.invalid",
      name: "Remitente",
      providerId: randomUUID(),
      body: "Hola",
      subject: "",
      identifierVerified: false,
      receivedAt: new Date(),
    });
    expect(result.conversation!.matchReview).toBe(true);
    expect(result.conversation!.clientId).toBeNull();
    const [client] = await db
      .select()
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.ownerId, owner),
          eq(schema.clients.email, "match-qa@example.invalid"),
        ),
      );
    await inbox.linkCommercialConversation({
      id: result.conversation!.id,
      clientId: client.id,
      revision: result.conversation!.revision,
      confirmed: true,
    });
    const [linked] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, result.conversation!.id));
    expect(linked.matchReview).toBe(false);
    expect(linked.clientId).toBe(client.id);
  });
  it("dos clics generan un solo envío y se conserva el recibo", async () => {
    const [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    await inbox.setCommercialMode({
      id: c.id,
      revision: c.revision,
      mode: "HUMAN",
    });
    const input = {
      conversationId,
      idempotencyKey: randomUUID(),
      body: "Respuesta revisada",
      subject: "Sitio",
    };
    transport.send.mockClear();
    await Promise.all([
      inbox.sendCommercialMessage(input),
      inbox.sendCommercialMessage(input),
    ]);
    expect(transport.send).toHaveBeenCalledTimes(1);
    expect(
      (await inbox.getCommercialThread(conversationId)).at(-1)?.delivery,
    ).toBe("sent");
    await expect(
      inbox.sendCommercialMessage({ ...input, body: "Cambio con misma clave" }),
    ).rejects.toThrow("otro mensaje");
  });
  it("fallo de proveedor y reintento seguro conservan la misma clave", async () => {
    transport.send.mockResolvedValueOnce({
      success: false,
      error: "email_provider_failed",
    });
    const failed = await inbox.sendCommercialMessage({
      conversationId,
      idempotencyKey: randomUUID(),
      body: "Reintento controlado",
      subject: "Sitio",
    });
    expect(failed.status).toBe("failed");
    const result = await inbox.retryCommercialMessage({ id: failed.id });
    expect(result.status).toBe("sent");
    const calls = transport.send.mock.calls;
    expect(calls.at(-1)?.[4].idempotencyKey).toBe(
      calls.at(-2)?.[4].idempotencyKey,
    );
  });
  it("asistente aprobado responde, traspasa decisiones y respeta pausa explícita", async () => {
    process.env.COMMERCIAL_AUTOMATION_ENABLED = "true";
    await inbox.saveCommercialPolicy({
      automaticEnabled: true,
      tone: "cercano",
      approvedAnswers: [
        {
          question: "¿Cuál es su horario?",
          answer: "Atendemos de lunes a viernes.",
        },
      ],
      revision: 0,
    });
    let [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    await inbox.setCommercialMode({
      id: c.id,
      revision: c.revision,
      mode: "BOT",
    });
    [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    transport.send.mockClear();
    await inbox.runApprovedCommercialReply(
      c,
      "Cuál es su horario?",
      randomUUID(),
    );
    expect(transport.send).toHaveBeenCalledTimes(1);
    [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    await inbox.runApprovedCommercialReply(
      c,
      "Necesito un descuento",
      randomUUID(),
    );
    [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    expect(c.mode).toBe("HUMAN");
    expect(c.state).toBe("decision");
    transport.send.mockClear();
    await inbox.runApprovedCommercialReply(
      c,
      "Cuál es su horario?",
      randomUUID(),
    );
    expect(transport.send).not.toHaveBeenCalled();
    await inbox.setCommercialMode({
      id: c.id,
      revision: c.revision,
      mode: "PAUSED",
    });
    [c] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    await inbox.setCommercialMode({
      id: c.id,
      revision: c.revision,
      mode: "HUMAN",
    });
  });
  it("WhatsApp preserva PixelBot, valida la ventana y utiliza una clave durable", async () => {
    process.env.PIXELBOT_TENANT_ID = "qa";
    process.env.EGRESS_WHATSAPP_MODE = "allowlist";
    process.env.EGRESS_WHATSAPP_ALLOWLIST = "+529990000566";
    const result = await inbound.ingestCommercialInbound(owner, {
      channel: "whatsapp",
      externalId: "+529990000566",
      address: "+529990000566",
      name: "WA QA",
      providerId: randomUUID(),
      body: "Consulta controlada",
      subject: "",
      identifierVerified: true,
      receivedAt: new Date(Date.now() - 25 * 3600000),
    });
    const c = result.conversation!;
    expect(
      await db
        .select()
        .from(schema.commercialMessages)
        .where(eq(schema.commercialMessages.conversationId, c.id)),
    ).toHaveLength(0);
    transport.pixelbot.mockImplementation(async (path: string) => ({
      status: 200,
      data: path.endsWith("/mode")
        ? { status: "ok", mode: "PAUSED" }
        : { status: "sent" },
    }));
    await inbox.setCommercialMode({
      id: c.id,
      revision: c.revision,
      mode: "HUMAN",
    });
    const outside = await inbox.sendCommercialMessage({
      conversationId: c.id,
      idempotencyKey: randomUUID(),
      body: "Respuesta QA",
      subject: "",
    });
    expect(outside.status).toBe("failed");
    expect(outside.error).toContain("ventana");
    await db
      .update(schema.commercialConversations)
      .set({ lastInboundAt: new Date() })
      .where(eq(schema.commercialConversations.id, c.id));
    transport.pixelbot.mockClear();
    const inside = await inbox.sendCommercialMessage({
      conversationId: c.id,
      idempotencyKey: randomUUID(),
      body: "Respuesta QA",
      subject: "",
    });
    expect(inside.status).toBe("sent");
    expect(
      transport.pixelbot.mock.calls.find(
        (call) => call[0] === "/internal/send",
      )?.[1].client_message_id,
    ).toBe(inside.id);
  });
  it("versiona la cotización, registra la decisión y crea una única venta", async () => {
    const input = {
      clientId,
      title: "Propuesta QA",
      items: [
        {
          description: "Sitio QA",
          quantity: 1,
          unitPriceCents: 100000,
          recurrence: "unica" as const,
        },
      ],
      taxEnabled: true,
      notes: "",
      validUntil: "2099-11-01",
      currency: "MXN" as const,
      problem: "Problema QA",
      solution: "Solución QA",
      scopeIncluded: "Sitio QA",
      exclusions: "Servicios adicionales",
      estimatedDelivery: "Acordar con el cliente",
      paymentTerms: { type: "50_50" as const, custom: "" },
      markReady: true,
    };
    const saved = await quotes.saveQuote(input);
    expect(saved.ok).toBe(true);
    if (!saved.ok || !saved.data) throw new Error("quote_save_failed");
    quoteId = saved.data.id;
    let [row] = await db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, quoteId));
    const edited = await quotes.saveQuote({
      ...input,
      id: quoteId,
      expectedVersion: 1,
      title: "Propuesta QA v2",
    });
    expect(edited.ok).toBe(true);
    expect(
      (await quotes.saveQuote({ ...input, id: quoteId, expectedVersion: 1 }))
        .ok,
    ).toBe(false);
    [row] = await db
      .select()
      .from(schema.quotes)
      .where(eq(schema.quotes.id, quoteId));
    expect(row.version).toBe(2);
    quoteToken = row.publicToken!;
    await expect(
      decisions.recordQuoteDecision(quoteToken, {
        version: 1,
        decision: "accept",
        actorName: "Cliente QA",
        comment: "",
      }),
    ).rejects.toThrow();
    await decisions.recordQuoteDecision(quoteToken, {
      version: 2,
      decision: "accept",
      actorName: "Cliente QA",
      comment: "",
    });
    await decisions.recordQuoteDecision(quoteToken, {
      version: 2,
      decision: "accept",
      actorName: "Cliente QA",
      comment: "",
    });
    const request = {
      id: quoteId,
      acceptedVia: "otro" as const,
      acceptedAt: "2026-10-10",
      note: "Prueba controlada",
    };
    const accepted = await Promise.all([
      quotes.acceptQuote(request),
      quotes.acceptQuote(request),
    ]);
    expect(accepted.every((r) => r.ok)).toBe(true);
    const saleRows = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.quotationId, quoteId));
    expect(saleRows).toHaveLength(1);
    const bills = await db
      .select()
      .from(schema.billingItems)
      .where(eq(schema.billingItems.saleId, saleRows[0].id));
    expect(bills).toHaveLength(2);
    billId = bills.find((b) => b.concept.includes("Anticipo"))!.id;
    expect(
      await db
        .select()
        .from(schema.quoteDecisions)
        .where(eq(schema.quoteDecisions.quoteId, quoteId)),
    ).toHaveLength(1);
  });
  it("pago parcial real, doble clic y anticipo completo aprovisionan un único proyecto", async () => {
    const [bill] = await db
      .select()
      .from(schema.billingItems)
      .where(eq(schema.billingItems.id, billId));
    const input = {
      billingItemId: billId,
      amount: "100.00",
      method: "transferencia",
      paidAt: "2026-10-10",
      reference: "QA",
      note: "Prueba sin dinero real",
      expectedPeriodDue: bill.dueDate,
      idempotencyKey: randomUUID(),
    };
    await Promise.allSettled([
      payment.recordCommercialPayment(input),
      payment.recordCommercialPayment(input),
    ]);
    const records = await db
      .select()
      .from(schema.paymentRecords)
      .where(eq(schema.paymentRecords.billingItemId, billId));
    expect(records).toHaveLength(1);
    expect(records[0].amount).toBe("100.00");
    const current = await snapshot.getCommercialSnapshot();
    expect(current.bills.find((b) => b.id === billId)?.status).toBe("parcial");
    await payment.recordCommercialPayment({
      ...input,
      amount: (Number(bill.amount) - 100).toFixed(2),
      idempotencyKey: randomUUID(),
    });
    const sale = (
      await db
        .select()
        .from(schema.sales)
        .where(eq(schema.sales.quotationId, quoteId))
    )[0];
    expect(sale.projectId).toBeTruthy();
    const p = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, sale.projectId!));
    expect(p).toHaveLength(1);
    await ops.updateCommercialProject({
      id: p[0].id,
      commercialRevision: p[0].commercialRevision,
      commercialStage: "revision",
      clientNote: "Avance QA visible al cliente",
      nextStep: "Revisar",
      nextStepDue: "2026-10-15",
    });
    const portal = await db
      .select()
      .from(schema.clientPortalUpdates)
      .where(eq(schema.clientPortalUpdates.clientId, clientId));
    expect(portal.at(-1)?.text).toContain("Avance QA visible al cliente");
  }, 30000);
  it("recordatorio programado se cancela si el saldo ya está liquidado", async () => {
    const freshBill = randomUUID();
    await db.insert(schema.billingItems).values({
      id: freshBill,
      ownerId: owner,
      clientId,
      amount: "100.00",
      currency: "MXN",
      concept: "Saldo QA",
      frequency: "unico",
      dueDate: "2026-10-10",
    });
    const r = await reminders.scheduleCommercialReminder({
      billingItemId: freshBill,
      conversationId,
      duePeriod: "2026-10-10",
      scheduledAt: new Date(),
      body: "Hola, saldo pendiente",
    });
    await db
      .update(schema.billingItems)
      .set({ status: "pagado" })
      .where(eq(schema.billingItems.id, freshBill));
    transport.send.mockClear();
    await reminders.sendDueCommercialReminder(r.id, owner);
    expect(transport.send).not.toHaveBeenCalled();
    expect(
      (
        await db
          .select()
          .from(schema.commercialReminders)
          .where(eq(schema.commercialReminders.id, r.id))
      )[0].status,
    ).toBe("cancelled");
  });
  it("recibo anticipado, repetido y fuera de orden conserva la entrega real", async () => {
    const { processCommercialEmailEvent } = await import("./email-events");
    const receiptId = randomUUID(),
      eventId = randomUUID();
    const event = {
      type: "email.delivered",
      created_at: new Date().toISOString(),
      data: { email_id: receiptId },
    };
    await processCommercialEmailEvent(event, eventId);
    transport.send.mockResolvedValueOnce({ success: true, id: receiptId });
    const sent = await inbox.sendCommercialMessage({
      conversationId,
      idempotencyKey: randomUUID(),
      body: "Recibo anticipado QA",
      subject: "Recibo QA",
    });
    expect(
      (
        await db
          .select()
          .from(schema.commercialOutbox)
          .where(eq(schema.commercialOutbox.id, sent.id))
      )[0].status,
    ).toBe("delivered");
    expect((await processCommercialEmailEvent(event, eventId)).repeated).toBe(
      true,
    );
    await expect(
      processCommercialEmailEvent({ ...event, type: "email.failed" }, eventId),
    ).rejects.toThrow("event_payload_conflict");
    await processCommercialEmailEvent(
      { ...event, type: "email.sent" },
      randomUUID(),
    );
    expect(
      (
        await db
          .select()
          .from(schema.commercialOutbox)
          .where(eq(schema.commercialOutbox.id, sent.id))
      )[0].status,
    ).toBe("delivered");
  });
  it("saldo parcial, fallo, cambio de saldo y reprogramación no duplican recordatorios", async () => {
    const id = randomUUID();
    await db
      .insert(schema.billingItems)
      .values({
        id,
        ownerId: owner,
        clientId,
        amount: "100.00",
        currency: "MXN",
        concept: "Parcial controlado",
        frequency: "unico",
        dueDate: "2026-10-10",
      });
    const pay = (amount: string) =>
      payment.recordCommercialPayment({
        billingItemId: id,
        amount,
        method: "transferencia",
        paidAt: "2026-10-10",
        reference: "QA",
        note: "Prueba aislada",
        expectedPeriodDue: "2026-10-10",
        idempotencyKey: randomUUID(),
      });
    await pay("40.00");
    const r = await reminders.scheduleCommercialReminder({
      billingItemId: id,
      conversationId,
      duePeriod: "2026-10-10",
      scheduledAt: new Date(),
      body: "Recordatorio QA",
    });
    transport.send.mockClear();
    transport.send.mockResolvedValueOnce({
      success: false,
      error: "email_provider_failed",
    });
    const failed = await reminders.sendDueCommercialReminder(r.id, owner);
    if (!("id" in failed)) throw new Error("Expected attempted reminder");
    expect(transport.send.mock.calls[0][2]).toContain("$60.00");
    await pay("20.00");
    expect((await inbox.retryCommercialMessage({ id: failed.id })).status).toBe(
      "failed",
    );
    expect(transport.send).toHaveBeenCalledTimes(1);
    const [current] = await db
      .select()
      .from(schema.commercialReminders)
      .where(eq(schema.commercialReminders.id, r.id));
    await reminders.pauseCommercialReminder({
      id: r.id,
      revision: current.revision,
    });
    await expect(
      inbox.retryCommercialMessage({ id: failed.id }),
    ).rejects.toThrow("pausado");
    expect(
      (
        await db
          .select()
          .from(schema.commercialOutbox)
          .where(eq(schema.commercialOutbox.id, failed.id!))
      )[0].status,
    ).toBe("failed");
    await reminders.scheduleCommercialReminder({
      billingItemId: id,
      conversationId,
      duePeriod: "2026-10-10",
      scheduledAt: new Date(),
      body: "Recordatorio actualizado QA",
    });
    await Promise.all([
      reminders.sendDueCommercialReminder(r.id, owner),
      reminders.sendDueCommercialReminder(r.id, owner),
    ]);
    expect(transport.send).toHaveBeenCalledTimes(2);
    expect(transport.send.mock.calls[1][2]).toContain("$40.00");
    expect(
      await db
        .select()
        .from(schema.paymentRecords)
        .where(eq(schema.paymentRecords.billingItemId, id)),
    ).toHaveLength(2);
    expect(
      (
        await db
          .select()
          .from(schema.commercialReminders)
          .where(eq(schema.commercialReminders.id, r.id))
      )[0].status,
    ).toBe("sent");
  });
  it("pestaña CRM antigua y colisión de identidad no borran ni modifican otra cartera", async () => {
    const { syncCrmClients } = await import("@/lib/db/repos/crm-sync");
    await expect(
      syncCrmClients(owner, [{ id: clientId, name: 17 } as never]),
    ).rejects.toThrow();
    await expect(syncCrmClients(owner, [])).rejects.toThrow(
      "cartera comercial cambió",
    );
    await expect(
      syncCrmClients(other, [
        {
          id: clientId,
          name: "Intento",
          email: "",
          phone: "",
          location: "",
          notes: "",
          projects: [],
          createdAt: new Date().toISOString(),
        },
      ]),
    ).rejects.toThrow("no disponible");
    expect(
      (
        await db
          .select()
          .from(schema.clients)
          .where(eq(schema.clients.id, clientId))
      )[0].name,
    ).not.toBe("Intento");
  });
  it("otra cartera, reviewer, staff financiero y sesión ausente no modifican datos", async () => {
    identity.id = other;
    const saleActions = await import("@/lib/sales/actions");
    expect(await saleActions.getSaleForQuoteAction(quoteId)).toEqual({
      ok: true,
      data: { sale: null },
    });
    await expect(inbox.getCommercialThread(conversationId)).rejects.toThrow(
      "no disponible",
    );
    expect((await snapshot.getCommercialSnapshot()).contacts).toHaveLength(0);
    identity.id = owner;
    identity.role = "reviewer";
    await expect(snapshot.getCommercialSnapshot()).rejects.toThrow("permiso");
    identity.role = "staff";
    await expect(payment.recordCommercialPayment({})).rejects.toThrow(
      "permiso",
    );
    identity.role = null;
    await expect(snapshot.getCommercialSnapshot()).rejects.toThrow(
      "iniciar sesión",
    );
    identity.role = "admin";
  });
});
