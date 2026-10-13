import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import {
  clients,
  commercialOpportunities,
  commercialConversations,
  commercialMessages,
  commercialOutbox,
  commercialPolicies,
  commercialReminders,
  projects,
  quoteDecisions,
} from "@/lib/db/schema";

const text = (max: number) => z.string().trim().max(max);
export const uuid = z.string().uuid();
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T12:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
  }, "La fecha no existe.");
export const contactInput = createInsertSchema(clients, {
  name: text(200).min(1),
  contactName: text(200),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[1-9]\d{7,14}$/),
  notes: text(4000),
})
  .pick({
    name: true,
    contactName: true,
    email: true,
    phone: true,
    notes: true,
  })
  .partial({ contactName: true, email: true, phone: true, notes: true })
  .extend({
    need: text(2000).min(1),
    source: createInsertSchema(commercialOpportunities).shape.source,
  })
  .strict();
export const opportunityInput = createInsertSchema(commercialOpportunities, {
  id: uuid,
  need: text(2000).min(1),
  nextAction: text(500),
  nextActionDue: day.nullable(),
  reason: text(2000),
  revision: z.number().int().min(0),
  assignedTo: uuid.nullable(),
  quoteId: uuid.nullable(),
})
  .pick({
    id: true,
    need: true,
    stage: true,
    nextAction: true,
    nextActionDue: true,
    reason: true,
    revision: true,
    assignedTo: true,
    quoteId: true,
  })
  .required({ id: true, revision: true })
  .strict();
export const projectInput = createInsertSchema(projects, {
  id: uuid,
  clientNote: text(4000),
  nextStep: text(500),
  nextStepDue: day.nullable(),
  commercialRevision: z.number().int().min(0),
})
  .pick({
    id: true,
    commercialStage: true,
    clientNote: true,
    nextStep: true,
    nextStepDue: true,
    commercialRevision: true,
  })
  .required()
  .strict();
export const modeInput = createInsertSchema(commercialConversations, {
  id: uuid,
  revision: z.number().int().min(0),
})
  .pick({ id: true, mode: true, revision: true })
  .required()
  .strict();
export const messageInput = createInsertSchema(commercialOutbox, {
  conversationId: uuid,
  idempotencyKey: uuid,
  body: text(4096).min(1),
  subject: text(200),
})
  .pick({
    conversationId: true,
    idempotencyKey: true,
    body: true,
    subject: true,
  })
  .required()
  .strict();
/** Permite una sincronización controlada de una conversación del tenant propio. */
export const whatsappSyncInput = createInsertSchema(commercialConversations, {
  address: z.string().regex(/^\+?[1-9]\d{7,14}$/),
})
  .pick({ address: true })
  .partial()
  .strict();
/** El cursor del proveedor nunca permite cambiar owner ni buzón receptor. */
export const emailSyncInput = createInsertSchema(commercialMessages, {
  providerId: uuid,
})
  .pick({ providerId: true })
  .extend({ after: uuid.optional() })
  .omit({ providerId: true })
  .strict();
export const policyInput = createInsertSchema(commercialPolicies, {
  approvedAnswers: z
    .array(
      z
        .object({ question: text(300).min(1), answer: text(3000).min(1) })
        .strict(),
    )
    .max(50),
  revision: z.number().int().min(0),
})
  .pick({
    automaticEnabled: true,
    tone: true,
    approvedAnswers: true,
    revision: true,
  })
  .required()
  .strict();
export const reminderInput = createInsertSchema(commercialReminders, {
  billingItemId: uuid,
  conversationId: uuid,
  duePeriod: day,
  scheduledAt: z.coerce.date(),
  body: text(3800).min(1),
})
  .pick({
    billingItemId: true,
    conversationId: true,
    duePeriod: true,
    scheduledAt: true,
    body: true,
  })
  .strict();
export const decisionInput = createInsertSchema(quoteDecisions, {
  version: z.number().int().min(1),
  actorName: text(200).min(1),
  comment: text(2000),
})
  .pick({ version: true, decision: true, actorName: true, comment: true })
  .required()
  .strict();
export const inboundInput = createInsertSchema(commercialMessages, {
  body: text(12000).min(1),
  providerId: text(200).min(1),
})
  .pick({ body: true, providerId: true })
  .required()
  .extend({
    channel: createSelectSchema(commercialConversations).shape.channel,
    externalId: text(200).min(1),
    address: text(254).min(1),
    name: text(200).min(1),
    subject: text(200),
    // Esta bandera solo la aporta un adaptador autenticado, nunca un endpoint público.
    identifierVerified: z.boolean(),
    receivedAt: z.coerce.date(),
  })
  .strict();
