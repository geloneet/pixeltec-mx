import {createHash,randomUUID} from 'node:crypto';
import {EditorialContentSchema} from './content-schema.mjs';
const fail=code=>{throw new Error(code);};
const stable=v=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
export const digest=v=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
const uuid=v=>{if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v??''))fail('INVALID_COMMAND_KEY');return v;};
const fields=['title','excerpt','body','slug','category','tags','coverImage','seo','sources','internalLinks','faq','mapsEmbed','ai','aiParams'];
const columns={title:'title',excerpt:'excerpt',body:'body',slug:'slug',category:'category',tags:'tags',coverImage:'cover_image',seo:'seo',sources:'sources',internalLinks:'internal_links',faq:'faq',mapsEmbed:'maps_embed',ai:'ai',aiParams:'ai_params'};
const jsonFields=new Set(['seo','sources','internalLinks','faq','ai','aiParams']);
const snapshotFields=['title','excerpt','body','slug','category','tags','cover_image','seo','editorial','sources','internal_links','ai'];
const snapshotJsonFields=new Set(['seo','editorial','sources','internal_links','ai']);
// Drizzle deja transparentes los serializers JSON de su $client compartido.
// Bind explícito de TEXTO + cast SQL: funciona con ese cliente y postgres.js puro,
// sin cambiar serializers globales ni codificar un objeto JSON dos veces.
const json=(tx,value)=>{
 const encoded=JSON.stringify(value);
 if(typeof encoded!=='string')fail('NON_SERIALIZABLE_JSON');
 return tx.typed(encoded,25);
};
const q=(tx,text,args=[])=>tx.unsafe(text,args);
const seq=v=>{if(!/^(0|[1-9][0-9]*)$/.test(String(v)))fail('INVALID_VERSION');return BigInt(v);};
const stamp=row=>new Date(row.updated_at).toISOString();
const material=row=>Object.fromEntries(fields.map(k=>[k,row[columns[k]]??({tags:[],sources:[],internalLinks:[],faq:[],seo:{},ai:{}}[k]??null)]));
function clean(base,patch) {
 if(!patch||typeof patch!=='object'||Object.keys(patch).some(k=>!fields.includes(k)))fail('INVALID_EDITORIAL_FIELDS');
 const c={...base,...structuredClone(patch)};
 if(Buffer.byteLength(JSON.stringify(c),'utf8')>800000)fail('CONTENT_TOO_LARGE');
 const nested=EditorialContentSchema.safeParse(c);
 if(!nested.success)fail('INVALID_CONTENT');
 Object.assign(c,nested.data);
 for(const [key,max] of [['title',300],['excerpt',160],['body',500000],['slug',120],['category',80]])if(typeof c[key]!=='string'||c[key].length>max)fail('INVALID_CONTENT');
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug))fail('INVALID_SLUG');
 if(!Array.isArray(c.sources)||c.sources.length>20||!Array.isArray(c.internalLinks)||c.internalLinks.length>20||!Array.isArray(c.tags)||c.tags.length>20||!Array.isArray(c.faq)||c.faq.length>20)fail('INVALID_CONTENT');
 for(const source of c.sources)if(!source||typeof source.id!=='string'||!source.id||typeof source.title!=='string'||source.title.length>300||typeof source.url!=='string'||source.url.length>2000)fail('INVALID_SOURCE');
 if(new Set(c.sources.map(s=>s.id)).size!==c.sources.length)fail('INVALID_SOURCE');
 for(const link of c.internalLinks)if(!link||typeof link.targetUrl!=='string'||link.targetUrl.length>2000||typeof link.anchor!=='string'||link.anchor.length>120)fail('INVALID_LINK');
 if(c.mapsEmbed!=null){const url=new URL(c.mapsEmbed);if(url.protocol!=='https:'||!['google.com','www.google.com','google.com.mx','www.google.com.mx'].includes(url.hostname)||!(url.pathname==='/maps/embed'||url.pathname.startsWith('/maps/embed/')))fail('INVALID_MAPS_EMBED');}
 if(c.coverImage!=null){const url=new URL(c.coverImage,'https://pixeltec.mx');if(!['https:','http:'].includes(url.protocol))fail('INVALID_COVER');}
 if(c.tags.some(t=>typeof t!=='string'||t.length>50)||c.faq.some(f=>!f||typeof f.question!=='string'||typeof f.answer!=='string'||f.question.length>300||f.answer.length>2000))fail('INVALID_CONTENT');
 c.sources=c.sources.map(s=>({...s,verifiedByHuman:false}));
 c.internalLinks=c.internalLinks.map(l=>({...l,verified:false}));
 c.ai={...c.ai,editedByHuman:false};
 return c;
}
const revisionDigest=(row,version,content)=>digest({id:row.id,ownerId:row.author.uid,author:row.author,version:String(version),content:content.fields,basePublicUpdatedAt:content.basePublicUpdatedAt});
const privateContent=(row)=>({fields:clean(material(row),{}),basePublicUpdatedAt:stamp(row),review:null});
const date=value=>value==null?null:new Date(value).toISOString();

/** Dependency injection is for real SQL tests and the canonical host only.
 * Nothing here trusts a principal, reviewer, author, receipt or role supplied
 * as a tool argument. authorize re-resolves the host identity on every use. */
export function createEditorialService({sql,authorize,publicationGate,invalidate=async(_paths)=>{}}) {
 if(!sql?.begin||typeof authorize!=='function'||typeof publicationGate!=='function')fail('HOST_CONFIGURATION_REQUIRED');
 async function actor(identity,admin=false) {
  const a=await authorize(identity);
  if(!a?.userId||!['admin','staff'].includes(a.role)||admin&&a.role!=='admin')fail('EDITORIAL_ACCESS_DENIED');
  return a;
 }
 async function fresh(identity,a,admin=false) {const b=await actor(identity,admin);if(b.userId!==a.userId||b.role!==a.role)fail('EDITORIAL_ACCESS_DENIED');}
 async function owned(tx,a,id,lock=false,includeDiscarded=false) {
  if(typeof id!=='string'||!id||id.length>200)fail('EDITORIAL_NOT_FOUND');
  const [r]=await q(tx,`select * from blog_posts where (id::text=$1 or firestore_id=$1) and ($2::boolean or not exists(select 1 from mcp_safety_candidate.editorial_drafts d where d.id=blog_posts.id and d.content ? 'discardedAt')) order by case when firestore_id=$1 then 0 else 1 end limit 1 ${lock?'for update':''}`,[id,includeDiscarded]);
  if(!r||r.author?.uid!==a.userId)fail('EDITORIAL_NOT_FOUND');return r;
 }
 async function state(tx,a,row,{includeDiscarded=false}={}) {
  const [d]=await q(tx,'select * from mcp_safety_candidate.editorial_drafts where id=$1 and owner_id=$2',[row.id,a.userId]);
  // A writer may have waited on the post lock using an older NOT EXISTS
  // snapshot. Recheck the current private state after that wait, before CAS.
  if(d?.content.discardedAt&&!includeDiscarded)fail('EDITORIAL_NOT_FOUND');
  return d??{id:row.id,owner_id:a.userId,version:'0',content:privateContent(row)};
 }
 const receipt=(row,d)=>({id:row.id,version:String(d.version),digest:revisionDigest(row,d.version,d.content),slug:d.content.fields.slug,status:row.status,publishedAt:date(row.published_at),scheduledAt:null,privateRevision:true});
 async function read(identity,id) {
  const a=await actor(identity);
  return sql.begin('isolation level repeatable read read only',async tx=>{
   const row=await owned(tx,a,id),d=await state(tx,a,row);
   const [scheduled]=await q(tx,"select due_at from mcp_safety_candidate.editorial_commands where owner_id=$1 and draft_id=$2 and state='queued' order by due_at limit 1",[a.userId,row.id]);
   const info=receipt(row,d);await fresh(identity,a);
   return {...info,scheduledAt:date(scheduled?.due_at),content:d.content.fields,author:row.author,createdAt:date(row.created_at),updatedAt:date(d.updated_at??row.updated_at),reviewed:d.content.review?.digest===info.digest};
  });
 }
 async function replay(tx,a,kind,key,hash) {
  uuid(key);await q(tx,'select pg_advisory_xact_lock(hashtextextended($1,0))',[a.userId+':'+kind+':'+key]);
  const [c]=await q(tx,'select * from mcp_safety_candidate.editorial_commands where owner_id=$1 and kind=$2 and request_key=$3',[a.userId,kind,key]);
  if(c&&c.payload_hash!==hash)fail('IDEMPOTENCY_CONFLICT');return c;
 }
 async function command(tx,a,row,{kind,key,hash,payload,receipt:result,state='done',slot=null,due=null}) {
  await q(tx,`insert into mcp_safety_candidate.editorial_commands(id,owner_id,draft_id,kind,request_key,payload_hash,payload,receipt,state,slot_key,due_at,created_by,updated_by,cache_state) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11::timestamptz,$2,$2,$12)`,[randomUUID(),a.userId,row.id,kind,key,hash,json(tx,payload),json(tx,result),state,slot,due==null?null:tx.typed(new Date(due).toISOString(),25),kind==='draft'?'done':'pending']);
 }
 async function persist(tx,a,row,d,content,version) {
  // No writer may replace terminal metadata. Idempotent discard returns
  // before persistence; restoring an ordinary archive is a separate contract.
  if(d.content?.discardedAt)fail('EDITORIAL_NOT_FOUND');
  const hash=revisionDigest(row,version,content);
  await q(tx,`insert into mcp_safety_candidate.editorial_drafts(id,owner_id,target_post_id,version,content,digest,created_by,updated_by) values($1,$2,$1,$3,$4::jsonb,$5,$2,$2) on conflict(id) do update set version=excluded.version,content=excluded.content,digest=excluded.digest,updated_by=excluded.updated_by,updated_at=now()`,[row.id,a.userId,String(version),json(tx,content),hash]);
  return {...d,version:String(version),content,digest:hash};
 }
 async function createDraft(identity,{requestKey,patch}) {
  const a=await actor(identity),hash=digest({mode:'create',patch});
  return sql.begin(async tx=>{
   const prior=await replay(tx,a,'draft',requestKey,hash);if(prior)return prior.receipt;
   const id=randomUUID(),temporarySlug='borrador-'+id;
   const [row]=await q(tx,"insert into blog_posts(id,slug,title,excerpt,body,category,author,status) values($1,$2,'','','','',$3::jsonb,'draft') returning *",[id,temporarySlug,json(tx,{uid:a.userId,name:a.name})]);
   const next=clean(privateContent(row).fields,patch);
   const d=await persist(tx,a,row,{}, {fields:next,basePublicUpdatedAt:stamp(row),review:null},1n),info=receipt(row,d);
   await command(tx,a,row,{kind:'draft',key:requestKey,hash,payload:{mode:'create'},receipt:info});
   await fresh(identity,a);return info;
  });
 }
 async function save(identity,{id,requestKey,expectedVersion,patch,invalidateReview=false}) {
  const a=await actor(identity),hash=digest({id,expectedVersion,patch,invalidateReview});
  return sql.begin(async tx=>{
   const prior=await replay(tx,a,'draft',requestKey,hash);if(prior)return prior.receipt;
   const row=await owned(tx,a,id,true),d=await state(tx,a,row);
   if(expectedVersion==null||seq(expectedVersion)!==seq(d.version))fail('EDITORIAL_STALE_VERSION');
   if(d.content.basePublicUpdatedAt!==stamp(row))fail('PUBLIC_BASE_CHANGED');
   const next=clean(d.content.fields,patch),unchanged=!invalidateReview&&d.version!=='0'&&digest(next)===digest(d.content.fields);
   const content={fields:next,basePublicUpdatedAt:stamp(row),review:unchanged?d.content.review:null};
   const stored=await persist(tx,a,row,d,content,unchanged?d.version:seq(d.version)+1n),result=receipt(row,stored);
   await command(tx,a,row,{kind:'draft',key:requestKey,hash,payload:{mode:'save'},receipt:result});
   await fresh(identity,a);return result;
  });
 }
 async function review(identity,{id,expectedDigest,requestKey,verifiedSourceIds,claimsVerified,verifiedLinks}) {
  const a=await actor(identity,true),hash=digest({mode:'review',id,expectedDigest,verifiedSourceIds,claimsVerified,verifiedLinks});
  return sql.begin(async tx=>{
   const prior=await replay(tx,a,'draft',requestKey,hash);if(prior)return prior.receipt;
   const row=await owned(tx,a,id,true),d=await state(tx,a,row),info=receipt(row,d);
   if(d.version==='0'||expectedDigest!==info.digest||d.content.basePublicUpdatedAt!==stamp(row))fail('EDITORIAL_STALE_DIGEST');
   const c=d.content.fields;
   if(!EditorialContentSchema.safeParse(c).success)fail('INVALID_CONTENT');
   for(const s of c.sources){let url;try{url=new URL(s.url);}catch{fail('SOURCE_REVIEW_REQUIRED');}if(s.title.trim().length<3||!['https:','http:'].includes(url.protocol))fail('SOURCE_REVIEW_REQUIRED');}
   for(const l of c.internalLinks){let url;try{url=new URL(l.targetUrl,'https://pixeltec.mx');}catch{fail('LINK_REVIEW_REQUIRED');}if(!l.targetUrl.trim()||l.anchor.trim().length<2||url.origin!=='https://pixeltec.mx')fail('LINK_REVIEW_REQUIRED');}
   if(c.sources.some(s=>typeof s.claimSupported!=='string'||!s.claimSupported.trim()||!Number.isFinite(Date.parse(s.accessedAt))||Date.parse(s.accessedAt)>Date.now()))fail('SOURCE_REVIEW_REQUIRED');
   if(claimsVerified!==true||!c.sources.length||!Array.isArray(verifiedSourceIds)||new Set(verifiedSourceIds).size!==c.sources.length||c.sources.some(s=>!verifiedSourceIds.includes(s.id)))fail('SOURCE_REVIEW_REQUIRED');
   if(!Array.isArray(verifiedLinks)||c.internalLinks.some(l=>!verifiedLinks.includes(l.targetUrl)))fail('LINK_REVIEW_REQUIRED');
   const content={...d.content,review:{digest:info.digest,reviewerId:a.userId,reviewedAt:new Date().toISOString(),verifiedSourceIds,verifiedLinks,claimsVerified:true}};
   await persist(tx,a,row,d,content,d.version);
   const result={...info,reviewed:true};
   await command(tx,a,row,{kind:'draft',key:requestKey,hash,payload:{mode:'human-review'},receipt:result});
   await fresh(identity,a,true);return result;
  });
 }
 function approved(row,d,expectedDigest) {
  const info=receipt(row,d),review=d.content.review;
  if(expectedDigest!==info.digest||d.content.basePublicUpdatedAt!==stamp(row))fail('EDITORIAL_STALE_DIGEST');
  if(!review||review.digest!==info.digest||!review.claimsVerified)fail('HUMAN_REVIEW_REQUIRED');
  const c=d.content.fields;
  if(!EditorialContentSchema.safeParse(c).success)fail('INVALID_CONTENT');
  const fields={...d.content.fields,sources:d.content.fields.sources.map(s=>({...s,verifiedByHuman:review.verifiedSourceIds.includes(s.id)})),internalLinks:d.content.fields.internalLinks.map(l=>({...l,verified:review.verifiedLinks.includes(l.targetUrl)})),ai:{...d.content.fields.ai,editedByHuman:true}};
  const editorial={reviewerId:review.reviewerId,reviewedAt:review.reviewedAt,claimsVerified:true,sourcesVerified:true};
  const verdict=publicationGate({...fields,author:row.author,status:'approved',editorial});
  if(!verdict?.ready)fail('CANONICAL_PUBLICATION_GATE_BLOCKED');return {fields,editorial,verdict};
 }
 async function setStatus(identity,{id,status,requestKey}) {
  if(!['draft','archived'].includes(status))fail('EXPLICIT_REVIEW_REQUIRED');
  const a=await actor(identity,true),hash=digest({mode:'visibility',id,status});
  const result=await sql.begin(async tx=>{
   const prior=await replay(tx,a,'publish',requestKey,hash);if(prior)return prior.receipt;
   const row=await owned(tx,a,id,true),d=await state(tx,a,row);
   const [updated]=await q(tx,'update blog_posts set status=$2,scheduled_at=null,updated_at=now() where id=$1 returning *',[row.id,status]);
   const content={...d.content,basePublicUpdatedAt:stamp(updated),review:null};
   const stored=await persist(tx,a,updated,d,content,seq(d.version)+1n),info=receipt(updated,stored);
   await q(tx,"update mcp_safety_candidate.editorial_commands set state='blocked',last_error_code='VISIBILITY_CHANGED',updated_at=now() where owner_id=$1 and draft_id=$2 and state='queued'",[a.userId,row.id]);
   await q(tx,"insert into blog_activity(id,post_id,type,message,actor_id,actor_name,metadata) values($1,$2,$3,'Cambio explícito de visibilidad',$4,$5,$6::jsonb)",[randomUUID(),row.id,status==='archived'?'archivado':'restaurado-archivo',a.userId,a.name,json(tx,{requestKey,status})]);
   await command(tx,a,row,{kind:'publish',key:requestKey,hash,payload:{mode:'visibility',slug:row.slug,oldSlug:row.slug},receipt:info});
   await fresh(identity,a,true);return info;
  });await recoverCache(identity);return result;
 }
 async function discardEmpty(identity,id) {
  const a=await actor(identity);
  return sql.begin(async tx=>{
   const row=await owned(tx,a,id,true,true),d=await state(tx,a,row,{includeDiscarded:true});
   if(d.content.discardedAt){await fresh(identity,a);return true;}
   // A public placeholder may be empty while the private revision has work.
   const blank=v=>v==null||v===false||v===0||typeof v==='string'&&!v.trim()||Array.isArray(v)&&v.every(blank)||typeof v==='object'&&Object.values(v).every(blank);
   const empty=c=>Object.entries(c).every(([k,v])=>k==='slug'||blank(v));
   if(row.status!=='draft'||row.published_at||!empty(material(row))||!empty(d.content.fields)||d.content.review)return false;
   const [updated]=await q(tx,"update blog_posts set status='archived',scheduled_at=null,updated_at=now() where id=$1 returning *",[row.id]);
   await persist(tx,a,updated,d,{...d.content,basePublicUpdatedAt:stamp(updated),discardedAt:new Date().toISOString(),review:null},seq(d.version)+1n);
   await q(tx,"update mcp_safety_candidate.editorial_commands set state='blocked',slot_key=null,last_error_code='DRAFT_DISCARDED',updated_at=now() where owner_id=$1 and draft_id=$2 and state='queued'",[a.userId,row.id]);
   await fresh(identity,a);return true;
  });
 }
 async function schedule(identity,{id,requestKey,expectedDigest,slot,dueAt}) {
  const a=await actor(identity,true),due=new Date(dueAt);
  if(!Number.isFinite(due.getTime())||typeof slot!=='string'||!slot||slot.length>200)fail('INVALID_SCHEDULE');
  const hash=digest({mode:'schedule',id,expectedDigest,slot,dueAt:due.toISOString()});
  return sql.begin(async tx=>{
   const prior=await replay(tx,a,'publish',requestKey,hash);if(prior){await fresh(identity,a,true);return prior.payload.scheduleReceipt??prior.receipt;}
   if(due.getTime()<=Date.now())fail('INVALID_SCHEDULE');
   const row=await owned(tx,a,id,true),d=await state(tx,a,row);approved(row,d,expectedDigest);
   await q(tx,'select pg_advisory_xact_lock(hashtextextended($1,0))',[a.userId+':editorial-slot:'+slot]);
   const [oldSlot]=await q(tx,'select * from mcp_safety_candidate.editorial_commands where owner_id=$1 and slot_key=$2 for update',[a.userId,slot]);
   if(oldSlot&&(oldSlot.state==='done'||oldSlot.draft_id!==row.id))fail('PUBLICATION_SLOT_USED');
   await q(tx,"update mcp_safety_candidate.editorial_commands set slot_key=null,state='blocked',last_error_code='SUPERSEDED',updated_at=now() where owner_id=$1 and draft_id=$2 and kind='publish' and (state='queued' or slot_key=$3)",[a.userId,row.id,slot]);
   const result={...receipt(row,d),scheduledAt:due.toISOString(),commandKey:requestKey,scheduled:true};
   await command(tx,a,row,{kind:'publish',key:requestKey,hash,payload:{mode:'schedule',expectedDigest,scheduleReceipt:result},receipt:result,state:'queued',slot,due});
   await fresh(identity,a,true);return result;
  });
 }
 async function snapshot(tx,a,row) {
  const extra={...row.editorial,safetySnapshot:{faq:row.faq,mapsEmbed:row.maps_embed,aiParams:row.ai_params}};
  const vals=snapshotFields.map(k=>snapshotJsonFields.has(k)?json(tx,k==='editorial'?extra:row[k]):row[k]);
  await q(tx,`insert into blog_post_versions(id,post_id,version,reason,${snapshotFields.join(',')},created_by_id,created_by_name) values($1,$2,(select coalesce(max(version),0)+1 from blog_post_versions where post_id=$2),'publicacion',${snapshotFields.map((k,n)=>'$'+(n+3)+(snapshotJsonFields.has(k)?'::jsonb':'')).join(',')},$${vals.length+3},$${vals.length+4})`,[randomUUID(),row.id,...vals,a.userId,a.name]);
 }
 async function publish(identity,{id,requestKey,expectedDigest},scheduled=false) {
  const a=await actor(identity,true),hash=digest({mode:'publish',id,expectedDigest});
  const result=await sql.begin(async tx=>{
   const prior=scheduled?(await q(tx,"select * from mcp_safety_candidate.editorial_commands where owner_id=$1 and kind='publish' and request_key=$2",[a.userId,uuid(requestKey)]))[0]:await replay(tx,a,'publish',requestKey,hash);
   if(prior?.state==='done')return prior.receipt;
   if(prior&&!scheduled)fail('IDEMPOTENCY_CONFLICT');
   if(scheduled&&(!prior||prior.state!=='queued'||new Date(prior.due_at)>new Date()||prior.payload.expectedDigest!==expectedDigest))fail('SCHEDULE_NOT_DUE');
   const row=await owned(tx,a,id,true),d=await state(tx,a,row);
   if(scheduled){const [locked]=await q(tx,"select state,due_at from mcp_safety_candidate.editorial_commands where owner_id=$1 and request_key=$2 and kind='publish' for update",[a.userId,requestKey]);if(locked?.state==='done')return prior.receipt;if(locked?.state!=='queued'||new Date(locked.due_at)>new Date())fail('SCHEDULE_NOT_DUE');}
   const candidate=approved(row,d,expectedDigest);
   await q(tx,'select pg_advisory_xact_lock(hashtextextended($1,0))',['blog-slug:'+candidate.fields.slug]);
   const conflicts=await q(tx,'select id::text from blog_posts where slug=$1 and id<>$2 union all select post_id::text from post_redirects where from_slug=$1',[candidate.fields.slug,row.id]);
   if(conflicts.length)fail('SLUG_CONFLICT');
   if(row.published_at&&row.slug!==candidate.fields.slug)await q(tx,'insert into post_redirects(from_slug,post_id) values($1,$2)',[row.slug,row.id]);
   const vals=fields.map(k=>jsonFields.has(k)?json(tx,candidate.fields[k]):candidate.fields[k]);
   const words=candidate.fields.body.trim().split(/\s+/).filter(Boolean).length;
   const [updated]=await q(tx,`update blog_posts set ${fields.map((k,n)=>columns[k]+'=$'+(n+2)+(jsonFields.has(k)?'::jsonb':'')).join(',')},status='published',published_at=coalesce(published_at,now()),scheduled_at=null,approved_by=$${vals.length+2},editorial=$${vals.length+3}::jsonb,word_count=$${vals.length+4},reading_time_min=$${vals.length+5},updated_at=now() where id=$1 returning *`,[row.id,...vals,a.userId,json(tx,candidate.editorial),words,Math.max(1,Math.ceil(words/200))]);
   await snapshot(tx,a,updated);
   await q(tx,"insert into blog_activity(id,post_id,type,message,actor_id,actor_name,metadata) values($1,$2,'publicado','Publicación editorial explícita',$3,$4,$5::jsonb)",[randomUUID(),row.id,a.userId,a.name,json(tx,{requestKey,approvedDigest:expectedDigest})]);
   const content={fields:clean(material(updated),{}),basePublicUpdatedAt:stamp(updated),review:null};
   const stored=await persist(tx,a,updated,d,content,seq(d.version)+1n);
   const info={...receipt(updated,stored),committed:true,approvedDigest:expectedDigest,publicHttpVerified:false,cacheStatus:'pending',verdict:candidate.verdict};
   const payload={...(scheduled?prior.payload:{}),mode:'publish',expectedDigest,slug:updated.slug,oldSlug:row.slug};
   if(scheduled)await q(tx,"update mcp_safety_candidate.editorial_commands set state='done',receipt=$3::jsonb,payload=$4::jsonb,updated_at=now() where owner_id=$1 and request_key=$2 and kind='publish'",[a.userId,requestKey,json(tx,info),json(tx,payload)]);
   else await command(tx,a,row,{kind:'publish',key:requestKey,hash,payload,receipt:info});
   await fresh(identity,a,true);return info;
  });
  await recoverCache(identity);return result;
 }
 async function recoverCache(identity) {
  const a=await actor(identity,true),jobs=await q(sql,"select id,payload from mcp_safety_candidate.editorial_commands where owner_id=$1 and kind='publish' and state='done' and cache_state='pending' order by created_at limit 100",[a.userId]);
  for(const job of jobs)try{
   await invalidate([...new Set(['/blog','/sitemap.xml','/blog/'+job.payload.slug,'/blog/'+job.payload.oldSlug])]);
   await q(sql,"update mcp_safety_candidate.editorial_commands set cache_state='done',cache_attempts=cache_attempts+1 where owner_id=$1 and id=$2",[a.userId,job.id]);
  }catch{/* Durable pending intent survives cache/network failure. */}
 }
 async function runDue(identity,{limit=100}={}) {
  const a=await actor(identity,true);if(!Number.isInteger(limit)||limit<1||limit>100)fail('INVALID_PAGE');
  const jobs=await q(sql,"select draft_id,request_key,payload from mcp_safety_candidate.editorial_commands where owner_id=$1 and kind='publish' and state='queued' and due_at<=now() order by due_at limit $2",[a.userId,limit]);
  const results=[];
  for(const job of jobs)try{results.push(await publish(identity,{id:job.draft_id,requestKey:job.request_key,expectedDigest:job.payload.expectedDigest},true));}
  catch(error){
    const permanent=['EDITORIAL_STALE_DIGEST','HUMAN_REVIEW_REQUIRED','CANONICAL_PUBLICATION_GATE_BLOCKED','SLUG_CONFLICT','INVALID_CONTENT'];
    const code=permanent.includes(error.message)?error.message:'EDITORIAL_RETRY_REQUIRED';
    if(permanent.includes(code))await q(sql,"update mcp_safety_candidate.editorial_commands set state='blocked',last_error_code=$3,updated_at=now() where owner_id=$1 and request_key=$2 and kind='publish' and state='queued'",[a.userId,job.request_key,code]);
    results.push({id:job.draft_id,committed:false,code});
   }
  return results;
 }
 return {read,createDraft,save,review,publish,schedule,runDue,recoverCache,setStatus,discardEmpty};
}
