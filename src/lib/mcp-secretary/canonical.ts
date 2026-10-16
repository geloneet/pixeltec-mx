/** Candidate to place inside the canonical CRM after governed admission.
 * Imports below resolve to actual pt.mx services/schema in the contract tests.
 * No server, credentials, grants or session impersonation are provisioned. */
import {createHash} from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clients, commercialOpportunities, projects, clientActivity,commercialCommands } from '@/lib/db/schema';
import { resolveAuthority } from '@/lib/auth/authority';
import { buildClientsQuery, loadQuotes, loadBilling } from '@/lib/hoy/queries/snapshot-queries';
import { opportunityInput } from '@/lib/commercial/schemas';

type VerifiedIdentity={issuer:string;subject:string;scopes:string[]};
export type Grant={userId:string;credentialIssuedAt:number;scopes:string[];expiresAt:number;revoked:boolean};
export type Principal={userId:string;role:string;scopes:string[];credentialIssuedAt:number};
const allowed=new Set(['crm:read','crm:prepare','crm:write:followup','crm:quotes:prepare','crm:write:quote-draft','channels:email:read','channels:whatsapp:read']);
const fail=(code:string):never=>{throw new Error(code);};
export function canonicalAuthority(resolveGrant:(identity:VerifiedIdentity)=>Promise<Grant|null>,clock=Date.now) {
 return async (identity:VerifiedIdentity):Promise<Principal|null>=>{
  // resolveGrant keys on issuer+subject and an approved durable consent record;
  // subjects are never treated as users.id without that mapping.
  if(!identity || !Array.isArray(identity.scopes))return null;
  const grant=await resolveGrant(identity);
  if(!grant || grant.revoked || grant.expiresAt<=clock() || !Number.isInteger(grant.credentialIssuedAt))return null;
  const current=await resolveAuthority(grant.userId,grant.credentialIssuedAt);
  if(!current.ok || !['admin','staff'].includes(current.role))return null;
  return {userId:current.userId,role:current.role,credentialIssuedAt:grant.credentialIssuedAt,
   scopes:identity.scopes.filter(s=>allowed.has(s)&&grant.scopes.includes(s))};
 };
}
async function revalidate(p:Principal,scope:string) {
 if(!p.scopes.includes(scope))fail('ACCESS_DENIED');
 const a=await resolveAuthority(p.userId,p.credentialIssuedAt);
 if(!a.ok || !['admin','staff'].includes(a.role))fail('ACCESS_DENIED');
}
export function buildOpportunitiesQuery(ownerId:string) {
 return db.select({id:commercialOpportunities.id,clientId:commercialOpportunities.clientId,stage:commercialOpportunities.stage,need:commercialOpportunities.need,nextAction:commercialOpportunities.nextAction,nextActionDue:commercialOpportunities.nextActionDue,revision:commercialOpportunities.revision})
 .from(commercialOpportunities).where(eq(commercialOpportunities.ownerId,ownerId)).orderBy(commercialOpportunities.id).limit(500);
}
export function buildProjectsQuery(ownerId:string) {
 return db.select({id:projects.id,clientId:projects.clientId,name:projects.name,stage:projects.commercialStage,nextStep:projects.nextStep,due:projects.nextStepDue,revision:projects.commercialRevision})
 .from(projects).innerJoin(clients,eq(clients.id,projects.clientId)).where(eq(clients.ownerId,ownerId)).orderBy(projects.id).limit(500);
}
export async function canonicalSnapshot(p:Principal,now=new Date(),options={includeBilling:false}) {
 await revalidate(p,'crm:read');
 const [contacts,opportunities,projectRows,quotes,bills]=await Promise.all([
  buildClientsQuery(p.userId).limit(500),buildOpportunitiesQuery(p.userId),buildProjectsQuery(p.userId),loadQuotes(p.userId,now),options.includeBilling?loadBilling(p.userId,now):Promise.resolve([]),
 ]);
 return {now:now.toISOString(),user:{id:p.userId},
  contacts:contacts.map(c=>({id:c.id,name:c.name,status:c.crmStatus,nextAction:c.nextAction})),
  opportunities,projects:projectRows,
  quotes:quotes.map(q=>({id:q.id,clientId:q.clientPgId,folio:q.folio,title:q.title,status:q.status,currency:q.currency})),
  bills:bills.map(b=>({id:b.id,clientId:b.clientPgId,concept:b.concept,amount:b.amount,currency:b.currency,status:b.status,dueDate:b.dueDate})),
  coverage:{maxPerEntity:500,quotes:'canonical Hoy window (35 days or open)',bills:options.includeBilling?'canonical Hoy window (14 days or pending)':'excluded from read pilot',fullExport:false},
 };
}

/** Restricted counterpart to operations.ts, sharing schema, revision lock and
 * clientActivity conventions. It cannot alter stage/assignee/price or send. */
export async function canonicalFollowup(p:Principal,command:{action:string;data:unknown;idempotencyKey:string}) {
 await revalidate(p,'crm:write:followup');
 if(command.action!=='opportunity')fail('UNSUPPORTED_ACTION');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(command.idempotencyKey))fail('INVALID_INPUT');
 const raw=command.data as Record<string,unknown>;
 if(!raw || Object.keys(raw).some(k=>!['id','revision','nextAction','nextActionDue'].includes(k)))fail('INVALID_INPUT');
 const data=opportunityInput.pick({id:true,revision:true,nextAction:true,nextActionDue:true}).required().strict().parse(raw);
 const payloadHash=createHash('sha256').update(JSON.stringify({owner:p.userId,action:command.action,data})).digest('hex');
 return db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${command.idempotencyKey},0))`);
  const [prior]=await tx.select().from(commercialCommands).where(eq(commercialCommands.id,command.idempotencyKey)).limit(1);
  if(prior){if(prior.ownerId!==p.userId||prior.action!=='mcp_followup'||prior.payloadHash!==payloadHash)fail('IDEMPOTENCY_CONFLICT');if(prior.status!=='done')fail('RECONCILIATION_REQUIRED');return prior.result as {id:string;revision:number};}
  const [row]=await tx.select().from(commercialOpportunities)
   .where(and(eq(commercialOpportunities.id,data.id),eq(commercialOpportunities.ownerId,p.userId))).for('update');
  if(!row)fail('NOT_FOUND');
  if(row.revision!==data.revision)fail('STALE_REVISION');
  await tx.update(commercialOpportunities).set({nextAction:data.nextAction,nextActionDue:data.nextActionDue,revision:data.revision+1,updatedAt:new Date()}).where(and(eq(commercialOpportunities.id,data.id),eq(commercialOpportunities.ownerId,p.userId)));
  await tx.insert(clientActivity).values({ownerId:p.userId,clientId:row.clientId,type:'seguimiento',message:'Próximo seguimiento actualizado por Pixeldot',actorName:'Pixeldot · delegación confirmada',metadata:{opportunityId:data.id,revision:data.revision+1,mcpIntentId:command.idempotencyKey,actorUserId:p.userId}});
  const receipt={id:data.id,revision:data.revision+1};
  await tx.insert(commercialCommands).values({id:command.idempotencyKey,ownerId:p.userId,resourceId:data.id,action:'mcp_followup',payloadHash,status:'done',result:receipt});
  return receipt;
 });
}
