/** Isolated draft-only adapter. Shares extracted, byte-checked canonical schema
 * and actual money/folio/ownership/versions tables. No tool/route/scope enabled. */
import {createHash,randomUUID,randomBytes} from 'node:crypto';
import {and,eq,sql} from 'drizzle-orm';
import {db} from '@/lib/db';
import {clients,quotes,quoteVersions,commercialCommands,clientActivity} from '@/lib/db/schema';
import {resolveAuthority} from '@/lib/auth/authority';
import {resolveOwnedClientPgId} from '@/lib/documents/pg';
import {usableItems,validateQuote,computeBreakdown} from '@/lib/quotes/money';
import {nextFolio} from '@/lib/quotes/folio';
import {defaultValidUntil,DEFAULT_EXCLUSIONS} from '@/lib/quotes/terms';
import {SaveQuoteSchema} from '@/lib/quotes/draft-contract';
import type {Principal} from './canonical';
function fail(code:string):never{throw new Error(code);}
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const commandId=(owner:string,key:string)=>{const h=digest(['mcp_quote_draft',owner,key]);return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;};
async function access(p:Principal,scope:string){
 if(!p.scopes.includes(scope))fail('QUOTE_ACCESS_DENIED');
 const a=await resolveAuthority(p.userId,p.credentialIssuedAt);if(!a.ok||!['admin','staff'].includes(a.role))fail('QUOTE_ACCESS_DENIED');
}
function normalize(raw:unknown,now=new Date()){
 const d=SaveQuoteSchema.parse(raw);if(d.markReady)fail('DRAFT_ONLY');
 const items=usableItems(d.items),issues=validateQuote({title:d.title,items,validUntil:d.validUntil});
 if(issues.length)fail('QUOTE_INVALID_INPUT');
 if(d.id&&!d.expectedVersion)fail('QUOTE_VERSION_REQUIRED');
 return {...d,markReady:false as const,items,title:d.title.trim(),notes:d.notes.trim(),problem:d.problem.trim(),solution:d.solution.trim(),scopeIncluded:d.scopeIncluded.trim(),exclusions:d.exclusions.trim()||DEFAULT_EXCLUSIONS,estimatedDelivery:d.estimatedDelivery.trim(),validUntil:d.validUntil?new Date(d.validUntil).toISOString():defaultValidUntil(now).toISOString()};
}
export async function prepareQuoteDraft(p:Principal,raw:unknown){
 await access(p,'crm:quotes:prepare');
 const data=normalize(raw),clientId=await resolveOwnedClientPgId(data.clientId,p.userId);if(!clientId)fail('QUOTE_NOT_FOUND');
 if(data.id){
  const [row]=await db.select().from(quotes).where(and(eq(quotes.id,data.id),eq(quotes.clientId,clientId))).limit(1);
  if(!row)fail('QUOTE_NOT_FOUND');if(row.status!=='borrador')fail('DRAFT_ONLY');if(row.version!==data.expectedVersion)fail('QUOTE_STALE_VERSION');
 }
 return {data,digest:digest({owner:p.userId,clientId,data}),clientId,totals:computeBreakdown(data.items,data.taxEnabled),currency:data.currency,effect:'save_draft_only' as const};
}
type Authorization={assignmentId:string;userId:string;requestKey:string;digest:string;action:'save_quote_draft'};
type Receipt={id:string;version:number;folio:string;clientId:string;status:'borrador'};
export async function saveQuoteDraft(p:Principal,input:{requestKey:string;digest:string;data:unknown},authorize:(intent:{userId:string;requestKey:string;digest:string;action:'save_quote_draft'})=>Promise<Authorization|null>,invalidate?:()=>Promise<void>){
 await access(p,'crm:write:quote-draft');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestKey))fail('QUOTE_INVALID_INPUT');
 const data=normalize(input.data),clientId=await resolveOwnedClientPgId(data.clientId,p.userId);if(!clientId)fail('QUOTE_NOT_FOUND');
 const expected=digest({owner:p.userId,clientId,data});if(expected!==input.digest)fail('QUOTE_DIGEST_MISMATCH');
 const cmd=commandId(p.userId,input.requestKey),action='save_quote_draft' as const;
 // The host validates a real user commission. Draft permission never authorizes
 // sending/sharing/acceptance/billing. No model-supplied boolean grants authority.
 const proof=await authorize({userId:p.userId,requestKey:input.requestKey,digest:expected,action});
 if(!proof?.assignmentId?.trim()||proof.userId!==p.userId||proof.requestKey!==input.requestKey||proof.digest!==expected||proof.action!==action)fail('QUOTE_AUTHORIZATION_REQUIRED');
 await access(p,'crm:write:quote-draft'); // Recheck authority after any user/broker wait.
 const outcome=await db.transaction(async tx=>{
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${cmd},0))`);
  const [owner]=await tx.select({id:clients.id}).from(clients).where(and(eq(clients.id,clientId),eq(clients.ownerId,p.userId))).for('share');if(!owner)fail('QUOTE_NOT_FOUND');
  const [prior]=await tx.select().from(commercialCommands).where(eq(commercialCommands.id,cmd));
  if(prior){if(prior.ownerId!==p.userId||prior.payloadHash!==expected||prior.action!=='mcp_quote_draft')fail('QUOTE_IDEMPOTENCY_CONFLICT');if(prior.status!=='done')fail('QUOTE_RECONCILIATION_REQUIRED');return {receipt:prior.result as Receipt,replayed:true};}
  const values={title:data.title,items:data.items,taxEnabled:data.taxEnabled,notes:data.notes,validUntil:new Date(data.validUntil),currency:data.currency,problem:data.problem,solution:data.solution,scopeIncluded:data.scopeIncluded,exclusions:data.exclusions,estimatedDelivery:data.estimatedDelivery,paymentTerms:data.paymentTerms};
  let row:typeof quotes.$inferSelect;
  if(data.id){
   const [locked]=await tx.select().from(quotes).where(and(eq(quotes.id,data.id),eq(quotes.clientId,clientId))).for('update');
   if(!locked)fail('QUOTE_NOT_FOUND');if(locked.status!=='borrador')fail('DRAFT_ONLY');if(locked.version!==data.expectedVersion)fail('QUOTE_STALE_VERSION');
   await tx.insert(quoteVersions).values({quoteId:locked.id,version:locked.version,snapshot:locked,createdBy:p.userId}).onConflictDoNothing();
   [row]=await tx.update(quotes).set({...values,version:locked.version+1,updatedAt:new Date()}).where(and(eq(quotes.id,locked.id),eq(quotes.version,locked.version))).returning();
  }else{
   await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended('pixeltec:quote-folio',0))`);
   const folios=await tx.select({folio:quotes.folio}).from(quotes);
   [row]=await tx.insert(quotes).values({...values,id:randomUUID(),clientId,folio:nextFolio(new Date().getFullYear(),folios.map(f=>f.folio)),status:'borrador',publicToken:randomBytes(24).toString('base64url'),createdBy:p.userId}).returning();
  }
  await tx.insert(quoteVersions).values({quoteId:row.id,version:row.version,snapshot:row,createdBy:p.userId});
  const receipt:Receipt={id:row.id,version:row.version,folio:row.folio,clientId,status:'borrador'};
  await tx.insert(clientActivity).values({ownerId:p.userId,clientId,type:'cotizacion',message:'Borrador de cotización guardado por encargo',actorName:'Pixeldot · encargo autorizado',metadata:{quoteId:row.id,version:row.version,mcpCommandId:cmd,assignmentId:proof.assignmentId,digest:expected}});
  await tx.insert(commercialCommands).values({id:cmd,ownerId:p.userId,resourceId:row.id,action:'mcp_quote_draft',payloadHash:expected,status:'done',result:receipt});
  return {receipt,replayed:false};
 });
 if(!invalidate)return {...outcome.receipt,replayed:outcome.replayed,cacheStatus:'not-configured'};
 try{await invalidate();return {...outcome.receipt,replayed:outcome.replayed,cacheStatus:'invalidated'};}catch{return {...outcome.receipt,replayed:outcome.replayed,cacheStatus:'retry-required'};}
}
