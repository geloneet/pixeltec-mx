import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import {
  clients,
  projects,
  tasks,
  recurringCharges,
  projectKeys,
  projectLogEntries,
} from "@/lib/db/schema";
const id = z.string().min(1).max(200);
const date = z
  .string()
  .max(40)
  .refine((v) => Number.isFinite(new Date(v).getTime()), "Fecha inválida");
const text = z.string().max(100000);
const task = createInsertSchema(tasks, {
  id,
  name: z.string().min(1).max(500),
  desc: text,
  createdAt: date,
})
  .pick({
    id: true,
    name: true,
    desc: true,
    status: true,
    prio: true,
    createdAt: true,
    pomoSessions: true,
  })
  .extend({ sessionId: id.optional() })
  .passthrough();
const charge = createInsertSchema(recurringCharges, {
  id,
  amount: z
    .string()
    .max(100)
    .refine(
      (v) =>
        Number.isFinite(Number(v.replace(/[^0-9.\-]/g, ""))) &&
        Number(v.replace(/[^0-9.\-]/g, "")) > 0,
      "Importe inválido",
    ),
  startDate: date,
  createdAt: date,
})
  .pick({
    id: true,
    concept: true,
    amount: true,
    frequency: true,
    startDate: true,
    clientEmail: true,
    active: true,
    createdAt: true,
  })
  .passthrough();
const key = createInsertSchema(projectKeys, {
  id,
  label: z.string().max(500),
  value: text,
})
  .pick({ id: true, label: true, value: true })
  .passthrough();
const log = createInsertSchema(projectLogEntries, {
  id,
  content: text,
  createdAt: date,
})
  .pick({
    id: true,
    category: true,
    content: true,
    authorName: true,
    createdAt: true,
  })
  .passthrough();
const project = createInsertSchema(projects, {
  id,
  name: z.string().min(1).max(200),
  budget: z.number().finite().nonnegative(),
  annual: z.number().finite().nonnegative(),
  createdAt: date,
  guides: text,
  accounts: text,
  readme: text,
  prompt: text,
  quickNotes: text,
})
  .pick({
    id: true,
    name: true,
    domain: true,
    budget: true,
    annual: true,
    budgetIva: true,
    annualIva: true,
    tech: true,
    guides: true,
    accounts: true,
    readme: true,
    prompt: true,
    quickNotes: true,
    contractId: true,
    createdAt: true,
  })
  .extend({
    tasks: z.array(task).max(5000).optional(),
    charges: z.array(charge).max(1000).optional(),
    keys: z.array(key).max(1000).optional(),
    notesLog: z.array(log).max(500).optional(),
  })
  .passthrough();
export const crmClientTreeInput = z
  .array(
    createInsertSchema(clients, {
      id,
      name: z.string().min(1).max(200),
      contactName: z.string().max(200),
      email: z.string().max(254).email().or(z.literal("")),
      phone: z.string().max(30),
      location: z.string().max(200),
      notes: text,
      portalToken: z.string().max(100),
      createdAt: date,
    })
      .pick({
        id: true,
        name: true,
        contactName: true,
        email: true,
        phone: true,
        location: true,
        notes: true,
        portalToken: true,
        portalEnabled: true,
        createdAt: true,
      })
      .partial({ contactName: true, portalToken: true })
      .extend({ projects: z.array(project).max(1000).optional() })
      .passthrough(),
  )
  .max(5000);
