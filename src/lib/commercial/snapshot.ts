import "server-only";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clients,
  projects,
  commercialOpportunities,
  commercialConversations,
  commercialMessages,
  commercialOutbox,
  commercialReminders,
  commercialPolicies,
  quoteDecisions,
  quotes,
  clientActivity,
} from "@/lib/db/schema";
import { getBillingItems } from "@/lib/documents/billing";
import { toQuoteRecord } from "@/lib/quotes/queries";
import { computeBreakdown } from "@/lib/quotes/money";
import { requireCommercialAccess } from "./access";

export async function getCommercialSnapshot() {
  const session = await requireCommercialAccess();
  const ownerId = session.userId;
  const [
    contacts,
    opportunityRows,
    projectRows,
    quoteRows,
    conversations,
    bills,
    reminders,
    policy,
    activity,
    outbox,
    decisions,
  ] = await Promise.all([
    db
      .select({
        id: clients.id,
        publicId: clients.firestoreId,
        name: clients.name,
        contactName: clients.contactName,
        email: clients.email,
        phone: clients.phone,
        status: clients.crmStatus,
        nextAction: clients.nextAction,
        portalEnabled: clients.portalAccessEnabled,
      })
      .from(clients)
      .where(eq(clients.ownerId, ownerId))
      .orderBy(clients.name),
    db
      .select()
      .from(commercialOpportunities)
      .where(eq(commercialOpportunities.ownerId, ownerId))
      .orderBy(desc(commercialOpportunities.updatedAt)),
    db
      .select({
        id: projects.id,
        publicId: projects.firestoreId,
        clientId: projects.clientId,
        name: projects.name,
        stage: projects.commercialStage,
        note: projects.clientNote,
        nextStep: projects.nextStep,
        due: projects.nextStepDue,
        revision: projects.commercialRevision,
      })
      .from(projects)
      .innerJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(clients.ownerId, ownerId)),
    db
      .select({ quote: quotes })
      .from(quotes)
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .where(eq(clients.ownerId, ownerId))
      .orderBy(desc(quotes.updatedAt)),
    db
      .select()
      .from(commercialConversations)
      .where(eq(commercialConversations.ownerId, ownerId))
      .orderBy(desc(commercialConversations.updatedAt)),
    getBillingItems(),
    db
      .select()
      .from(commercialReminders)
      .where(eq(commercialReminders.ownerId, ownerId)),
    db
      .select()
      .from(commercialPolicies)
      .where(eq(commercialPolicies.ownerId, ownerId)),
    db
      .select()
      .from(clientActivity)
      .where(eq(clientActivity.ownerId, ownerId))
      .orderBy(desc(clientActivity.createdAt))
      .limit(100),
    db
      .select()
      .from(commercialOutbox)
      .where(eq(commercialOutbox.ownerId, ownerId))
      .orderBy(desc(commercialOutbox.createdAt))
      .limit(100),
    db
      .select({ decision: quoteDecisions })
      .from(quoteDecisions)
      .innerJoin(quotes, eq(quotes.id, quoteDecisions.quoteId))
      .innerJoin(clients, eq(clients.id, quotes.clientId))
      .where(eq(clients.ownerId, ownerId)),
  ]);
  // Proyecciones explícitas. Nunca enviar proyectos.accounts/prompt/readme,
  // hashes OTP, secretos ni metadatos de autenticación al navegador.
  return {
    now: new Date().toISOString(),
    user: {
      id: ownerId,
      name: session.email.split("@")[0],
      role: session.role,
    },
    contacts,
    opportunities: opportunityRows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    projects: projectRows,
    quotes: quoteRows.map(({ quote }) => {
      const record = toQuoteRecord(quote);
      return {
        ...record,
        totals: computeBreakdown(record.items, record.taxEnabled),
      };
    }),
    conversations: conversations.map((r) => ({
      ...r,
      lastInboundAt: r.lastInboundAt?.toISOString() ?? null,
      updatedAt: r.updatedAt.toISOString(),
    })),
    bills,
    reminders: reminders.map((r) => ({
      ...r,
      scheduledAt: r.scheduledAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    policy: policy[0]
      ? {
          automaticEnabled: policy[0].automaticEnabled,
          tone: policy[0].tone,
          approvedAnswers: policy[0].approvedAnswers,
          revision: policy[0].revision,
        }
      : {
          automaticEnabled: false,
          tone: "cercano" as const,
          approvedAnswers: [],
          revision: 0,
        },
    activity: activity.map((r) => ({
      id: r.id,
      clientId: r.clientId,
      type: r.type,
      message: r.message,
      actorName: r.actorName,
      metadata: r.metadata,
      createdAt: r.createdAt.toISOString(),
    })),
    outbox: outbox.map((r) => ({
      id: r.id,
      conversationId: r.conversationId,
      status: r.status,
      errorCode: r.errorCode,
      createdAt: r.createdAt.toISOString(),
    })),
    decisions: decisions.map(({ decision }) => ({
      ...decision,
      createdAt: decision.createdAt.toISOString(),
    })),
  };
}
export type CommercialSnapshot = Awaited<
  ReturnType<typeof getCommercialSnapshot>
>;
