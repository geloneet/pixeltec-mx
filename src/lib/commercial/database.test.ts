/** Postgres real aislado. Transportes controlados: no certifica proveedores externos. */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, and, sql } from "drizzle-orm";
import { config } from "dotenv";
const identity = vi.hoisted(() => ({ id: "", role: "admin" as string | null }));
const transport = vi.hoisted(() => ({ send: vi.fn(), pixelbot: vi.fn() }));
const receivedTransport = vi.hoisted(() => ({ list: vi.fn(), get: vi.fn() }));
const phoneConnection = vi.hoisted(() => ({
  status: "CONNECTED" as string | null,
  verification: "EXPIRED",
  unavailable: false,
}));
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
  listCommercialReceivedEmails: receivedTransport.list,
  getCommercialReceivedEmail: receivedTransport.get,
  verifyCommercialEmailDomain: async () => ({
    verified: false,
    reason: "Transporte controlado",
  }),
}));
vi.mock("@/lib/whatsapp-inbox/pixelbot-client", () => ({
  fetchPixelbot: transport.pixelbot,
}));
vi.mock("@/lib/whatsapp/management", () => ({
  getPhoneNumberInfo: async () => {
    if (phoneConnection.unavailable) throw new Error("provider_unavailable");
    return {
      connectionStatus: phoneConnection.status,
      codeVerificationStatus: phoneConnection.verification,
    };
  },
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
let sharing: typeof import("./sharing");
let emailEvents: typeof import("./email-events");
let owner: string;
let other: string;
let clientId: string;
let conversationId: string;
let quoteId: string;
let quoteToken: string;
let billId: string;
const recoveredEmail = {
  id: randomUUID(),
  from: `Recuperación <${randomUUID()}@example.invalid>`,
  to: ["Inbox <receiving-qa@example.invalid>"],
  subject: "Correo recuperable QA",
  text: "Necesito información",
  html: null,
  created_at: new Date().toISOString(),
};
async function withIsolatedOwners(run: (owner: string, other: string) => Promise<void>) {
  const previous = identity.id;
  const owner = randomUUID(), other = randomUUID();
  await db.insert(schema.users).values([owner, other].map(id => ({
    id, email: id + "@example.invalid", role: "admin" as const,
    status: "active" as const, passwordHash: "!qa-no-login", name: "QA vínculo aislado",
  })));
  identity.id = owner;
  try {
    await run(owner, other);
  } finally {
    identity.id = previous;
  }
}
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
    sharing = await import("./sharing");
    emailEvents = await import("./email-events");
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
    expect(result.conversation!.opportunityId).toBeNull();
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
  it("el hilo manual enlaza la oportunidad activa de su propia cartera", async () => withIsolatedOwners(async (owner, other) => {
    const email = randomUUID() + "@example.invalid";
    await ops.createCommercialContact({
      name: "Correo manual QA",
      email,
      need: "Sitio",
      source: "manual",
    });
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.email, email));
    const [opportunity] = await db
      .select()
      .from(schema.commercialOpportunities)
      .where(and(eq(schema.commercialOpportunities.clientId, client.id), eq(schema.commercialOpportunities.ownerId, owner)));
    const opened = await sharing.openCommercialEmailConversation({ clientId: client.id });
    const [conversation] = await db.select().from(schema.commercialConversations).where(eq(schema.commercialConversations.id, opened.id));
    expect(conversation.opportunityId).toBe(opportunity.id);
    identity.id = other;
    try {
      await expect(sharing.openCommercialEmailConversation({ clientId: client.id })).rejects.toThrow("correo válido");
    } finally {
      identity.id = owner;
    }
  }));
  it("recepción y replay reparan un vínculo antiguo sin duplicar oportunidad, mensaje o actividad", async () => withIsolatedOwners(async (owner) => {
    const email = randomUUID() + "@example.invalid";
    await ops.createCommercialContact({ name: "Hilo antiguo QA", email, need: "Sistema", source: "manual" });
    const [client] = await db.select().from(schema.clients).where(eq(schema.clients.email, email));
    const [opportunity] = await db.select().from(schema.commercialOpportunities).where(eq(schema.commercialOpportunities.clientId, client.id));
    const opened = await sharing.openCommercialEmailConversation({ clientId: client.id });
    // Fixture of a thread created before opportunity linkage was implemented.
    await db.update(schema.commercialConversations).set({ opportunityId: null }).where(eq(schema.commercialConversations.id, opened.id));
    const input = { channel: "email", externalId: email, address: email, name: "Hilo antiguo QA", providerId: randomUUID(), body: "Necesito información", subject: "Consulta", identifierVerified: false, receivedAt: new Date() };
    const [first, duplicate] = await Promise.all([inbound.ingestCommercialInbound(owner, input), inbound.ingestCommercialInbound(owner, input)]);
    expect([first.repeated, duplicate.repeated].sort()).toEqual([false, true]);
    expect(first.conversation?.opportunityId).toBe(opportunity.id);
    expect(duplicate.conversation?.opportunityId).toBe(opportunity.id);
    expect(first.conversation?.mode).toBe("HUMAN");
    const [before] = await db.select().from(schema.commercialConversations).where(eq(schema.commercialConversations.id, opened.id));
    // A persisted old event must also repair its legacy thread on replay.
    await db.update(schema.commercialConversations).set({ opportunityId: null }).where(eq(schema.commercialConversations.id, opened.id));
    const [a, b] = await Promise.all([inbound.ingestCommercialInbound(owner, input), inbound.ingestCommercialInbound(owner, input)]);
    expect(a.repeated && b.repeated).toBe(true);
    expect(a.conversation?.opportunityId).toBe(opportunity.id);
    expect(a.conversation?.revision).toBe(before.revision + 1);
    expect(b.conversation?.revision).toBe(before.revision + 1);
    expect((await db.select().from(schema.commercialOpportunities).where(eq(schema.commercialOpportunities.clientId, client.id))).length).toBe(1);
    expect((await inbox.getCommercialThread(opened.id)).length).toBe(1);
    const activities = await db.select().from(schema.clientActivity).where(and(eq(schema.clientActivity.ownerId, owner), eq(schema.clientActivity.clientId, client.id)));
    expect(activities.filter(a => a.type === "mensaje_entrante")).toHaveLength(1);
    expect(activities.filter(a => a.type === "commercial_opportunity_linked")).toHaveLength(2);
  }));
  it("la recepción de un hilo antiguo sin oportunidad crea una sola y rechaza contactos ajenos", async () => withIsolatedOwners(async (owner, other) => {
    const id = randomUUID(), email = id + "@example.invalid";
    await db.insert(schema.clients).values({ id, firestoreId: id, ownerId: owner, source: "crm_blob", name: "Sin oportunidad QA", email });
    const opened = await sharing.openCommercialEmailConversation({ clientId: id });
    const input = { channel: "email", externalId: email, address: email, name: "Sin oportunidad QA", providerId: randomUUID(), body: "Consulta nueva", subject: "", identifierVerified: false, receivedAt: new Date() };
    const result = await inbound.ingestCommercialInbound(owner, input);
    expect(result.conversation?.opportunityId).toBeTruthy();
    expect((await db.select().from(schema.commercialOpportunities).where(eq(schema.commercialOpportunities.clientId, id))).length).toBe(1);
    const foreign = randomUUID();
    await db.insert(schema.clients).values({ id: foreign, firestoreId: foreign, ownerId: other, source: "crm_blob", name: "Otra cartera" });
    // An inconsistent legacy relation cannot cross the ownership boundary.
    await db.update(schema.commercialConversations).set({ clientId: foreign, opportunityId: null }).where(eq(schema.commercialConversations.id, opened.id));
    await expect(inbound.ingestCommercialInbound(owner, { ...input, providerId: randomUUID() })).rejects.toThrow("Contacto no disponible");
    expect((await db.select().from(schema.commercialOpportunities).where(eq(schema.commercialOpportunities.clientId, foreign))).length).toBe(0);
    expect((await db.select().from(schema.commercialMessages).where(eq(schema.commercialMessages.conversationId, opened.id))).length).toBe(1);
  }));
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
    process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE = "false";
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
    const insideInput = {
      conversationId: c.id,
      idempotencyKey: randomUUID(),
      body: "Respuesta QA",
      subject: "",
    };
    const inside = await inbox.sendCommercialMessage(insideInput);
    expect(inside.status).toBe("sent");
    expect((await inbox.sendCommercialMessage(insideInput)).id).toBe(inside.id);
    expect(
      transport.pixelbot.mock.calls.filter(
        ([path]) => path === "/internal/send",
      ),
    ).toHaveLength(1);
    expect(
      transport.pixelbot.mock.calls.find(
        (call) => call[0] === "/internal/send",
      )?.[1].client_message_id,
    ).toBe(inside.id);
    transport.pixelbot
      .mockClear()
      .mockResolvedValue({ status: 200, data: { status: "ok", mode: "BOT" } });
    const unpaused = await inbox.sendCommercialMessage({
      ...insideInput,
      idempotencyKey: randomUUID(),
    });
    expect(unpaused.status).toBe("failed");
    expect(
      transport.pixelbot.mock.calls.some(([path]) => path === "/internal/send"),
    ).toBe(false);
    const [policy] = await db
      .select()
      .from(schema.commercialPolicies)
      .where(eq(schema.commercialPolicies.ownerId, owner));
    await db
      .update(schema.commercialPolicies)
      .set({ automaticEnabled: true })
      .where(eq(schema.commercialPolicies.ownerId, owner));
    await db
      .update(schema.commercialConversations)
      .set({ mode: "BOT" })
      .where(eq(schema.commercialConversations.id, c.id));
    const [current] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, c.id));
    const [queued] = await db
      .insert(schema.commercialOutbox)
      .values({
        ownerId: owner,
        actorId: owner,
        conversationId: c.id,
        idempotencyKey: randomUUID(),
        body: "Respuesta automática QA",
        subject: "",
        payloadHash: "qa-auto-guard",
        status: "queued",
      })
      .returning();
    transport.pixelbot.mockClear();
    const blockedAuto = await inbox.dispatchCommercialOutbox(queued.id, owner, {
      automatic: true,
      inboundAt: current.lastInboundAt,
      policyRevision: policy.revision,
    });
    expect(blockedAuto.error).toBe("whatsapp_handoff_pending");
    expect(transport.pixelbot).not.toHaveBeenCalled();
    await db
      .update(schema.commercialPolicies)
      .set({ automaticEnabled: policy.automaticEnabled })
      .where(eq(schema.commercialPolicies.ownerId, owner));
    await db
      .update(schema.commercialConversations)
      .set({ mode: "HUMAN" })
      .where(eq(schema.commercialConversations.id, c.id));
    process.env.COMMERCIAL_WHATSAPP_EXCLUSIVE = "true";
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
  it("compartir un avance repetido envía y registra una sola comunicación", async () => {
    const [sale] = await db
      .select()
      .from(schema.sales)
      .where(eq(schema.sales.quotationId, quoteId));
    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, sale.projectId!));
    await db
      .update(schema.clients)
      .set({ portalAccessEnabled: true })
      .where(
        and(eq(schema.clients.id, clientId), eq(schema.clients.ownerId, owner)),
      );
    const [conversation] = await db
      .select()
      .from(schema.commercialConversations)
      .where(eq(schema.commercialConversations.id, conversationId));
    await inbox.setCommercialMode({
      id: conversationId,
      revision: conversation.revision,
      mode: "HUMAN",
    });
    const input = {
      id: project.id,
      conversationId,
      expectedRevision: project.commercialRevision,
      idempotencyKey: randomUUID(),
    };
    transport.send.mockClear();
    const first = await sharing.shareCommercialProject(input);
    const replay = await sharing.shareCommercialProject(input);
    await Promise.all([
      sharing.shareCommercialProject(input),
      sharing.shareCommercialProject(input),
    ]);
    expect(first.status).toBe("sent");
    expect(replay.id).toBe(first.id);
    expect(transport.send).toHaveBeenCalledTimes(1);
    const history = await db
      .select()
      .from(schema.clientActivity)
      .where(
        and(
          eq(schema.clientActivity.ownerId, owner),
          eq(schema.clientActivity.clientId, clientId),
          eq(schema.clientActivity.type, "commercial_project_shared"),
          sql`${schema.clientActivity.metadata}->>'outboxId' = ${first.id}`,
        ),
      );
    expect(history).toHaveLength(1);
    expect(history[0].metadata).toMatchObject({
      projectId: project.id,
      revision: project.commercialRevision,
      outboxId: first.id,
    });
    identity.id = other;
    try {
      await expect(sharing.shareCommercialProject(input)).rejects.toThrow(
        "Proyecto no disponible",
      );
    } finally {
      identity.id = owner;
    }
    expect(transport.send).toHaveBeenCalledTimes(1);
  });
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
    await db.insert(schema.billingItems).values({
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
  it("sincronización dirigida solo importa el destinatario solicitado y conserva aislamiento", async () => {
    identity.id = owner;
    identity.role = "admin";
    const address = "15550000566";
    transport.pixelbot.mockReset().mockImplementation(async (path: string) => ({
      status: 200,
      data: path.includes("/messages?")
        ? {
            messages: [
              {
                id: "targeted-inbound-qa",
                direction: "inbound",
                text: "Prueba controlada",
                createdAt: "2026-10-01 16:27:37",
              },
            ],
          }
        : { conversations: [{ id: address }, { id: "15550000999" }] },
    }));
    const a = await inbox.synchronizeCommercialWhatsApp(undefined, { address });
    const b = await inbox.synchronizeCommercialWhatsApp(undefined, { address });
    expect(a.imported).toBe(1);
    expect(b.imported).toBe(0);
    expect(
      transport.pixelbot.mock.calls
        .filter(([path]) => path.includes("/messages?"))
        .every(([path]) => path.includes(address)),
    ).toBe(true);
    const rows = await db
      .select()
      .from(schema.commercialConversations)
      .where(
        and(
          eq(schema.commercialConversations.ownerId, owner),
          eq(schema.commercialConversations.address, address),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0].lastInboundAt?.toISOString()).toBe(
      "2026-10-01T16:27:37.000Z",
    );
    await expect(
      inbox.synchronizeCommercialWhatsApp(undefined, {
        address,
        tenant_id: "another",
      }),
    ).rejects.toThrow();
    identity.id = other;
    await expect(
      inbox.synchronizeCommercialWhatsApp(undefined, { address }),
    ).rejects.toThrow("Tenant no asignado");
    identity.id = owner;
  });
  it("WhatsApp enlaza el wamid auténtico y recupera un ACK ya persistido sin repetir transporte", async () =>
    withIsolatedOwners(async (isolated) => {
      const previousOwner = process.env.COMMERCIAL_OWNER_ID;
      process.env.COMMERCIAL_OWNER_ID = isolated;
      process.env.PIXELBOT_TENANT_ID = "qa";
      process.env.EGRESS_WHATSAPP_MODE = "allowlist";
      process.env.EGRESS_WHATSAPP_ALLOWLIST = "+15550000028";
      try {
        const c = (
          await inbound.ingestCommercialInbound(isolated, {
            channel: "whatsapp",
            externalId: "15550000028",
            address: "15550000028",
            name: "Recibo QA",
            providerId: randomUUID(),
            body: "Consulta",
            subject: "",
            identifierVerified: true,
            receivedAt: new Date(),
          })
        ).conversation!;
        await db
          .update(schema.commercialConversations)
          .set({ mode: "HUMAN" })
          .where(eq(schema.commercialConversations.id, c.id));
        for (const status of ["sent", "already_persisted"]) {
          transport.pixelbot
            .mockReset()
            .mockImplementation(
              async (path: string, body: { client_message_id: string }) => ({
                status: 200,
                data: path.endsWith("/mode")
                  ? { status: "ok", mode: "PAUSED" }
                  : {
                      status,
                      clientMessageId: body.client_message_id,
                      providerMessageId: "wamid." + body.client_message_id,
                      providerStatus: status === "sent" ? "sent" : "read",
                    },
              }),
            );
          const input = {
            conversationId: c.id,
            idempotencyKey: randomUUID(),
            body: "Recibo controlado",
            subject: "",
          };
          const result = await inbox.sendCommercialMessage(input);
          expect(result.error).toBeUndefined();
          expect(result.status).toBe(status === "sent" ? "sent" : "delivered");
          const [row] = await db
            .select()
            .from(schema.commercialOutbox)
            .where(eq(schema.commercialOutbox.id, result.id));
          expect(row.providerId).toBe("wamid." + result.id);
          expect((await inbox.sendCommercialMessage(input)).id).toBe(result.id);
          expect(
            transport.pixelbot.mock.calls.filter(
              ([path]) => path === "/internal/send",
            ),
          ).toHaveLength(1);
        }
        transport.pixelbot
          .mockReset()
          .mockImplementation(
            async (path: string, body: { client_message_id: string }) => ({
              status: 200,
              data: path.endsWith("/mode")
                ? { status: "ok", mode: "PAUSED" }
                : {
                    status: "sent",
                    clientMessageId: body.client_message_id,
                    providerMessageId: null,
                    providerStatus: "unknown",
                  },
            }),
          );
        const unknown = await inbox.sendCommercialMessage({
          conversationId: c.id,
          idempotencyKey: randomUUID(),
          body: "ACK incierto",
          subject: "",
        });
        expect(unknown.status).toBe("unknown");
        expect(
          await db
            .select()
            .from(schema.commercialMessages)
            .where(eq(schema.commercialMessages.conversationId, c.id)),
        ).toHaveLength(0);
      } finally {
        process.env.COMMERCIAL_OWNER_ID = previousOwner;
      }
    }));
  it("sincroniza recibos propios una sola vez, conserva terminales y rechaza la correlación ajena", async () =>
    withIsolatedOwners(async (isolated, foreign) => {
      const previousOwner = process.env.COMMERCIAL_OWNER_ID;
      process.env.COMMERCIAL_OWNER_ID = isolated;
      process.env.PIXELBOT_TENANT_ID = "qa";
      try {
        const address = "15550000029";
        const c = (
          await inbound.ingestCommercialInbound(isolated, {
            channel: "whatsapp",
            externalId: address,
            address,
            name: "Sincronización QA",
            providerId: randomUUID(),
            body: "Consulta",
            subject: "",
            identifierVerified: true,
            receivedAt: new Date(),
          })
        ).conversation!;
        const [row] = await db
          .insert(schema.commercialOutbox)
          .values({
            ownerId: isolated,
            actorId: isolated,
            conversationId: c.id,
            idempotencyKey: randomUUID(),
            body: "Intención original",
            payloadHash: "qa-native-receipt",
            status: "unknown",
            attempts: 1,
          })
          .returning();
        let message = {
          id: "qa-native-outbound",
          direction: "outbound",
          text: row.body,
          clientMessageId: row.id,
          waMessageId: "wamid." + row.id,
          from: isolated,
          deliveryStatus: "read",
          createdAt: new Date().toISOString(),
        };
        transport.pixelbot
          .mockReset()
          .mockImplementation(async (path: string) => ({
            status: 200,
            data: path.includes("/messages?")
              ? { messages: [message] }
              : { conversations: [{ id: address }] },
          }));
        for (const mismatch of [
          { text: "Otro contenido" },
          { from: foreign },
          { clientMessageId: randomUUID() },
          { waMessageId: row.id },
        ]) {
          const original = message;
          message = { ...message, ...mismatch };
          expect(
            (await inbox.synchronizeCommercialWhatsApp(undefined, { address }))
              .reconciled,
          ).toBe(0);
          message = original;
        }
        const results = await Promise.all([
          inbox.synchronizeCommercialWhatsApp(undefined, { address }),
          inbox.synchronizeCommercialWhatsApp(undefined, { address }),
        ]);
        expect(results.reduce((sum, r) => sum + r.reconciled, 0)).toBe(1);
        message.deliveryStatus = "sent";
        expect(
          (await inbox.synchronizeCommercialWhatsApp(undefined, { address }))
            .reconciled,
        ).toBe(0);
        let [updated] = await db
          .select()
          .from(schema.commercialOutbox)
          .where(eq(schema.commercialOutbox.id, row.id));
        expect(updated.status).toBe("delivered");
        expect(updated.providerId).toBe(message.waMessageId);
        expect(
          await db
            .select()
            .from(schema.clientActivity)
            .where(
              and(
                eq(schema.clientActivity.ownerId, isolated),
                eq(schema.clientActivity.type, "commercial_delivery"),
              ),
            ),
        ).toHaveLength(1);
        expect(
          await db
            .select()
            .from(schema.commercialMessages)
            .where(eq(schema.commercialMessages.conversationId, c.id)),
        ).toHaveLength(0);
        message.waMessageId = "wamid.conflicting-provider";
        await expect(
          inbox.synchronizeCommercialWhatsApp(undefined, { address }),
        ).rejects.toThrow("whatsapp_receipt_conflict");
        message.waMessageId = "wamid." + row.id;
        await db
          .update(schema.commercialOutbox)
          .set({ status: "failed" })
          .where(eq(schema.commercialOutbox.id, row.id));
        message.deliveryStatus = "delivered";
        expect(
          (await inbox.synchronizeCommercialWhatsApp(undefined, { address }))
            .reconciled,
        ).toBe(0);
        [updated] = await db
          .select()
          .from(schema.commercialOutbox)
          .where(eq(schema.commercialOutbox.id, row.id));
        expect(updated.status).toBe("failed");
        identity.id = foreign;
        await expect(
          inbox.synchronizeCommercialWhatsApp(undefined, { address }),
        ).rejects.toThrow("Tenant no asignado");
      } finally {
        process.env.COMMERCIAL_OWNER_ID = previousOwner;
      }
    }));
  it("recupera solo el receptor propio, deduplica concurrentes y no ejecuta respuestas", async () => {
    identity.id = owner;
    identity.role = "admin";
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "receiving-qa@example.invalid");
    vi.stubEnv("COMMERCIAL_AUTOMATION_ENABLED", "true");
    const unrelated = {
      ...recoveredEmail,
      id: randomUUID(),
      to: ["other-account@example.invalid"],
    };
    receivedTransport.list
      .mockReset()
      .mockResolvedValue({ data: [recoveredEmail, unrelated], has_more: true });
    receivedTransport.get.mockReset().mockResolvedValue(recoveredEmail);
    const reply = vi.spyOn(inbox, "runApprovedCommercialReply");
    try {
      const results = await Promise.all([
        emailEvents.synchronizeCommercialEmail({}),
        emailEvents.synchronizeCommercialEmail({}),
      ]);
      expect(results.map((r) => r.imported).sort()).toEqual([0, 1]);
      expect(results.every((r) => r.nextCursor === unrelated.id)).toBe(true);
      expect(
        receivedTransport.get.mock.calls.every(
          ([id]) => id === recoveredEmail.id,
        ),
      ).toBe(true);
      expect(reply).not.toHaveBeenCalled();
      const [message] = await db
        .select()
        .from(schema.commercialMessages)
        .where(eq(schema.commercialMessages.providerId, recoveredEmail.id));
      const rows = await db
        .select()
        .from(schema.commercialMessages)
        .where(eq(schema.commercialMessages.providerId, recoveredEmail.id));
      expect(rows).toHaveLength(1);
      expect(message.delivery).toBe("received");
      const [c] = await db
        .select()
        .from(schema.commercialConversations)
        .where(eq(schema.commercialConversations.id, message.conversationId));
      expect(c.ownerId).toBe(owner);
      expect(c.mode).toBe("HUMAN");
      expect(c.clientId).not.toBeNull();
      expect(c.opportunityId).not.toBeNull();
      const ids = await db
        .select()
        .from(schema.commercialIdentifiers)
        .where(eq(schema.commercialIdentifiers.clientId, c.clientId!));
      expect(ids).toHaveLength(1);
      expect(ids[0].verifiedAt).toBeNull();
      expect(
        (
          await db
            .select()
            .from(schema.clientActivity)
            .where(eq(schema.clientActivity.clientId, c.clientId!))
        ).filter((a) => a.type === "mensaje_entrante"),
      ).toHaveLength(1);
      expect(
        (
          await db
            .select()
            .from(schema.commercialWebhookEvents)
            .where(
              eq(
                schema.commercialWebhookEvents.provider,
                "resend_verified_inbound",
              ),
            )
        ).filter((e) => e.providerMessageId === recoveredEmail.id),
      ).toHaveLength(0);
      receivedTransport.list.mockResolvedValue({ data: [], has_more: false });
      expect(
        await emailEvents.synchronizeCommercialEmail({ after: unrelated.id }),
      ).toEqual({ ok: true, imported: 0, nextCursor: null });
      expect(receivedTransport.list).toHaveBeenLastCalledWith(unrelated.id);
    } finally {
      reply.mockRestore();
      vi.unstubAllEnvs();
    }
  });
  it("el callback después del pull comparte deduplicación y acredita solo la cartera propia", async () => {
    identity.id = owner;
    identity.role = "admin";
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "receiving-qa@example.invalid");
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "test-only-secret");
    receivedTransport.get.mockResolvedValue(recoveredEmail);
    try {
      expect(
        (await inbox.verifyCommercialConnections()).receiving.verified,
      ).toBe(false);
      const event = {
        type: "email.received",
        created_at: recoveredEmail.created_at,
        data: { email_id: recoveredEmail.id, to: recoveredEmail.to },
      };
      const eventId = "controlled-qa-" + randomUUID();
      expect(
        await emailEvents.processCommercialEmailEvent(event, eventId),
      ).toEqual({ ok: true, repeated: true });
      expect(
        await emailEvents.processCommercialEmailEvent(event, eventId),
      ).toEqual({ ok: true, repeated: true });
      expect(
        await db
          .select()
          .from(schema.commercialMessages)
          .where(eq(schema.commercialMessages.providerId, recoveredEmail.id)),
      ).toHaveLength(1);
      expect(
        (await inbox.verifyCommercialConnections()).receiving.verified,
      ).toBe(true);
      identity.id = other;
      expect(
        (await inbox.verifyCommercialConnections()).receiving.verified,
      ).toBe(false);
      identity.id = owner;
      vi.stubEnv("RESEND_WEBHOOK_SECRET", "");
      expect(
        (await inbox.verifyCommercialConnections()).receiving.verified,
      ).toBe(false);
    } finally {
      identity.id = owner;
      vi.unstubAllEnvs();
    }
  });
  it("callback de otro receptor no lee cuerpos y evento repetido alterado se rechaza antes del proveedor", async () => {
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "receiving-qa@example.invalid");
    receivedTransport.get.mockClear();
    const event = {
      type: "email.received",
      created_at: recoveredEmail.created_at,
      data: {
        email_id: recoveredEmail.id,
        to: ["other-account@example.invalid"],
      },
    };
    try {
      expect(
        await emailEvents.processCommercialEmailEvent(event, randomUUID()),
      ).toEqual({ ignored: true });
      await expect(
        emailEvents.processCommercialEmailEvent(
          { ...event, data: { email_id: recoveredEmail.id } },
          randomUUID(),
        ),
      ).rejects.toThrow();
      expect(receivedTransport.get).not.toHaveBeenCalled();
      const ownEvent = {
        ...event,
        data: { email_id: recoveredEmail.id, to: recoveredEmail.to },
      };
      const id = randomUUID();
      receivedTransport.get.mockResolvedValue(recoveredEmail);
      await emailEvents.processCommercialEmailEvent(ownEvent, id);
      receivedTransport.get.mockClear();
      await expect(
        emailEvents.processCommercialEmailEvent(
          { ...ownEvent, data: { ...ownEvent.data, email_id: randomUUID() } },
          id,
        ),
      ).rejects.toThrow("event_payload_conflict");
      expect(receivedTransport.get).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("un callback interrumpido se recupera sin certificar una recepción prematura", async () => {
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "receiving-qa@example.invalid");
    const email = { ...recoveredEmail, id: randomUUID() };
    const id = randomUUID();
    const event = {
      type: "email.received",
      created_at: email.created_at,
      data: { email_id: email.id, to: email.to },
    };
    receivedTransport.get
      .mockReset()
      .mockRejectedValueOnce(new Error("controlled_provider_failure"))
      .mockResolvedValue(email);
    try {
      await expect(
        emailEvents.processCommercialEmailEvent(event, id),
      ).rejects.toThrow("controlled_provider_failure");
      const [pending] = await db
        .select()
        .from(schema.commercialWebhookEvents)
        .where(eq(schema.commercialWebhookEvents.id, "resend-inbound:" + id));
      expect(pending.status).toBe("processing");
      expect(pending.processedAt).toBeNull();
      expect(await emailEvents.processCommercialEmailEvent(event, id)).toEqual({
        ok: true,
        repeated: false,
      });
      expect(await emailEvents.processCommercialEmailEvent(event, id)).toEqual({
        ok: true,
        repeated: true,
      });
      expect(
        await db
          .select()
          .from(schema.commercialMessages)
          .where(eq(schema.commercialMessages.providerId, email.id)),
      ).toHaveLength(1);
      const [done] = await db
        .select()
        .from(schema.commercialWebhookEvents)
        .where(eq(schema.commercialWebhookEvents.id, "resend-inbound:" + id));
      expect(done.status).toBe("done");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("recuperación exige admin, owner, receptor e input válido antes de consultar el proveedor", async () => {
    receivedTransport.list.mockClear();
    try {
      for (const role of ["staff", "reviewer", null]) {
        identity.role = role;
        await expect(
          emailEvents.synchronizeCommercialEmail({}),
        ).rejects.toThrow();
      }
      identity.role = "admin";
      identity.id = other;
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "Tenant no asignado",
      );
      identity.id = owner;
      await expect(
        emailEvents.synchronizeCommercialEmail({ ownerId: other }),
      ).rejects.toThrow();
      await expect(
        emailEvents.synchronizeCommercialEmail({ after: "invalid" }),
      ).rejects.toThrow();
      vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "false");
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "email_receiving_disabled",
      );
      vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
      vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "invalid");
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "email_receiving_addresses_not_configured",
      );
      expect(receivedTransport.list).not.toHaveBeenCalled();
    } finally {
      identity.id = owner;
      identity.role = "admin";
      vi.unstubAllEnvs();
    }
  });
  it("provider inconsistente o fallo parcial no contamina otra cartera y el replay recupera una sola copia", async () => {
    vi.stubEnv("COMMERCIAL_EMAIL_RECEIVING_ENABLED", "true");
    vi.stubEnv("COMMERCIAL_INBOUND_ADDRESSES", "receiving-qa@example.invalid");
    const second = {
      ...recoveredEmail,
      id: randomUUID(),
      text: "Otro correo",
      created_at: new Date().toISOString(),
    };
    receivedTransport.list
      .mockReset()
      .mockResolvedValue({ data: [recoveredEmail, second], has_more: false });
    receivedTransport.get.mockReset().mockImplementation(async (id: string) => {
      if (id === second.id) throw new Error("provider_unavailable");
      return recoveredEmail;
    });
    try {
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "email_receiving_provider_failed",
      );
      expect(
        await db
          .select()
          .from(schema.commercialMessages)
          .where(eq(schema.commercialMessages.providerId, recoveredEmail.id)),
      ).toHaveLength(1);
      receivedTransport.get.mockImplementation(async (id: string) =>
        id === second.id ? second : recoveredEmail,
      );
      expect(await emailEvents.synchronizeCommercialEmail({})).toEqual({
        ok: true,
        imported: 1,
        nextCursor: null,
      });
      expect(await emailEvents.synchronizeCommercialEmail({})).toEqual({
        ok: true,
        imported: 0,
        nextCursor: null,
      });
      receivedTransport.list.mockResolvedValue({
        data: [second],
        has_more: false,
      });
      receivedTransport.get.mockResolvedValue({ ...second, id: randomUUID() });
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "email_receiving_provider_failed",
      );
      receivedTransport.list.mockResolvedValue({ data: [], has_more: true });
      await expect(emailEvents.synchronizeCommercialEmail({})).rejects.toThrow(
        "email_receiving_provider_failed",
      );
      receivedTransport.list.mockResolvedValue({
        data: [{ ...second, id: "invalid" }],
        has_more: false,
      });
      await expect(
        emailEvents.synchronizeCommercialEmail({}),
      ).rejects.toThrow();
      expect(
        await db
          .select()
          .from(schema.commercialMessages)
          .where(eq(schema.commercialMessages.providerId, second.id)),
      ).toHaveLength(1);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("conexión Meta activa no se confunde con el código expirado y falla cerrada", async () => {
    identity.id = owner;
    identity.role = "admin";
    transport.pixelbot.mockResolvedValue({
      data: { conversations: [] },
      status: 200,
    });
    try {
      phoneConnection.status = "CONNECTED";
      phoneConnection.verification = "EXPIRED";
      expect(
        (await inbox.verifyCommercialConnections()).whatsapp.verified,
      ).toBe(true);
      phoneConnection.status = "DISCONNECTED";
      phoneConnection.verification = "VERIFIED";
      expect(
        (await inbox.verifyCommercialConnections()).whatsapp.verified,
      ).toBe(false);
      phoneConnection.status = null;
      expect(
        (await inbox.verifyCommercialConnections()).whatsapp.verified,
      ).toBe(false);
      phoneConnection.status = "CONNECTED";
      phoneConnection.unavailable = true;
      expect(
        (await inbox.verifyCommercialConnections()).whatsapp.verified,
      ).toBe(false);
      identity.role = "staff";
      await expect(inbox.verifyCommercialConnections()).rejects.toThrow(
        "permiso",
      );
    } finally {
      identity.role = "admin";
      phoneConnection.status = "CONNECTED";
      phoneConnection.verification = "EXPIRED";
      phoneConnection.unavailable = false;
    }
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
