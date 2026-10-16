import 'server-only';
import {and,eq,desc} from 'drizzle-orm';
import {db} from '@/lib/db';
import {commercialConversations,commercialMessages} from '@/lib/db/schema';
import {fetchPixelbot} from '@/lib/whatsapp-inbox/pixelbot-client';
import {canonicalAuthority,type Grant} from './canonical';
import {createChannelCandidate} from './channels-vendor/channels.mjs';
import {registerChannelTools} from './channels-vendor/register.mjs';

/** Owner DB reads, never cookie-backed actions/synchronization. WhatsApp uses
 * an explicitly approved user→tenant binding, not browser/global-role inference. */
export function canonicalChannelTools(options:{resolveGrant:(i:any)=>Promise<Grant|null>;tenantBindings:Record<string,string>;audit:(owner:string|null,action:string,status:string)=>Promise<void>}){
 const authority=canonicalAuthority(options.resolveGrant);
 const api=createChannelCandidate({
  authorize:async(identity:any,scope:string)=>{
   const p=await authority(identity);if(!p||!p.scopes.includes(scope))return null;
   const tenantId=options.tenantBindings[p.userId];
   if(scope!=='channels:email:read'&&!tenantId)return null;
   return {...p,ownerId:p.userId,tenantId};
  },
  commercialSnapshot:async(c:any)=>({user:{id:c.ownerId},conversations:await db.select({id:commercialConversations.id,ownerId:commercialConversations.ownerId,channel:commercialConversations.channel,subject:commercialConversations.subject,mode:commercialConversations.mode,state:commercialConversations.state,lastInboundAt:commercialConversations.lastInboundAt,updatedAt:commercialConversations.updatedAt}).from(commercialConversations).where(and(eq(commercialConversations.ownerId,c.ownerId),eq(commercialConversations.channel,'email'))).orderBy(commercialConversations.id).limit(500)}),
  emailMessages:async(c:any,id:string,limit:number)=>{
   const rows=await db.select({id:commercialMessages.id,conversationId:commercialMessages.conversationId,direction:commercialMessages.direction,body:commercialMessages.body,delivery:commercialMessages.delivery,createdAt:commercialMessages.createdAt})
    .from(commercialMessages).innerJoin(commercialConversations,eq(commercialConversations.id,commercialMessages.conversationId))
    .where(and(eq(commercialConversations.id,id),eq(commercialConversations.ownerId,c.ownerId),eq(commercialConversations.channel,'email'))).orderBy(desc(commercialMessages.createdAt),desc(commercialMessages.id)).limit(limit);
   return rows.reverse();
  },
  pixelbotRead:async(c:any,path:string,params?:{limit:number})=>{
   if(options.tenantBindings[c.userId]!==c.tenantId)throw new Error('ACCESS_DENIED');
   if(!/^\/internal\/conversations(?:\/(?:%2[Bb])?[0-9]+\/messages)?$/.test(path))throw new Error('SOURCE_INVALID');
   const query=new URLSearchParams({tenant_id:c.tenantId,...(params?{limit:String(params.limit)}:{})});
   const result=await fetchPixelbot(path+'?'+query,undefined,'GET');if(result.status!==200)throw new Error('SOURCE_UNAVAILABLE');return result.data;
  },
 });
 // Audit before returning content. Audit failure closes the read; no PII payload
 // is logged. Owner is independently resolved again, never supplied by tools.
 const wrapped=Object.fromEntries(Object.entries(api).map(([name,fn])=>[name,async(i:any,args:any)=>{
  const p=await authority(i);if(!p)throw new Error('ACCESS_DENIED');
  try{const result=await (fn as Function)(i,args);await options.audit(p.userId,name,'ok');return result;}
  catch(error){await options.audit(p.userId,name,'failed');throw error;}
 }]));
 return (server:any,z:any,identity:any)=>registerChannelTools(server,z,wrapped,identity,{enableReads:true,enablePrepare:false});
}
