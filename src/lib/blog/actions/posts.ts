'use server';
// All editorial writes delegate to the same durable private-revision service.
import {requireAdmin} from '@/lib/auth-guards';
import {BlogPostEditSchema,type BlogPostEditInput,type ActionResult} from '../schemas';
import {normalizeCandidate,validatePostForPublication,SLUG_RE,type PublicationVerdict} from '../publication-gate';
import {logBlogActivity} from '../activity';
import {editorialService,editorialSessionIdentity as identity} from '../editorial/host';
async function attempt<T>(fn:()=>Promise<T>):Promise<ActionResult<T>> {try{return {ok:true,data:await fn()};}catch{return {ok:false,error:'No se completó la operación. Revisa permisos, versión y revisión editorial.'};}}
export async function createManualPost(): Promise<ActionResult<{ id: string }>> {
  return attempt(async()=>{const result=await editorialService.createDraft(identity,{requestKey:crypto.randomUUID(),patch:{title:'Borrador sin título',slug:'borrador-'+crypto.randomUUID().slice(0,8),category:'automatización'}});return {id:result.id};});
}

export async function updatePost(postId:string,input:BlogPostEditInput):Promise<ActionResult> {
 const p=BlogPostEditSchema.safeParse(input);if(!p.success||p.data.expectedVersion==null)return {ok:false,error:'Actualiza el editor para guardar con control de versión.'};
 const result=await attempt(async()=>{
  const d=p.data,current=await editorialService.read(identity,postId);
  const seo={...current.content.seo,metaTitle:d.seoMetaTitle??current.content.seo.metaTitle,metaDescription:d.seoMetaDescription??d.excerpt,ogImageAlt:d.coverImageAlt??current.content.seo.ogImageAlt,canonicalUrl:d.canonicalUrl??current.content.seo.canonicalUrl,noindex:d.noindex??current.content.seo.noindex,primaryKeyword:d.primaryKeyword??current.content.seo.primaryKeyword,secondaryKeywords:d.secondaryKeywords??current.content.seo.secondaryKeywords,searchIntent:d.searchIntent??current.content.seo.searchIntent,contentPillar:d.contentPillar??current.content.seo.contentPillar};
  await editorialService.save(identity,{id:current.id,requestKey:d.requestKey??crypto.randomUUID(),expectedVersion:d.expectedVersion,patch:{title:d.title,excerpt:d.excerpt,body:d.body,category:d.category,tags:d.tags,coverImage:d.coverImage??null,seo,sources:d.sources??current.content.sources,internalLinks:d.internalLinks??current.content.internalLinks}});
 });return result;
}
export async function requestReview(postId:string):Promise<ActionResult> {return attempt(async()=>{const r=await editorialService.read(identity,postId);await editorialService.save(identity,{id:r.id,requestKey:crypto.randomUUID(),expectedVersion:r.version,patch:{},invalidateReview:true});});}
export async function returnWithComments(postId:string,comment:string):Promise<ActionResult> {
 const guard=await requireAdmin(undefined,{route:'blog:return'});if(!guard.ok)return {ok:false,error:guard.error};
 if(comment.trim().length<5)return {ok:false,error:'Escribe un comentario de al menos 5 caracteres.'};
 return attempt(async()=>{const r=await editorialService.read(identity,postId);await editorialService.save(identity,{id:r.id,requestKey:crypto.randomUUID(),expectedVersion:r.version,patch:{},invalidateReview:true});await logBlogActivity({postId:r.id,type:'devuelto',message:comment.trim().slice(0,500),actorId:guard.uid});});
}
export async function unarchivePost(postId:string):Promise<ActionResult> {return attempt(async()=>{await editorialService.setStatus(identity,{id:postId,status:'draft',requestKey:crypto.randomUUID()});});}
export async function approvePost(postId:string,proof?:{expectedDigest:string;verifiedSourceIds:string[];verifiedLinks:string[];claimsVerified:true;requestKey:string}):Promise<ActionResult> {
 if(!proof)return {ok:false,error:'Revisa explícitamente esta versión y sus fuentes en el editor.'};
 return attempt(async()=>{await editorialService.review(identity,{id:postId,...proof});});
}
export async function getPublicationReadiness(postId:string):Promise<ActionResult<PublicationVerdict>> {
 return attempt(async()=>{const r=await editorialService.read(identity,postId);return validatePostForPublication(normalizeCandidate({...r.content,author:r.author,status:r.reviewed?'approved':'draft',sources:r.content.sources.map((s:Record<string,unknown>)=>({...s,verifiedByHuman:r.reviewed})),editorial:{reviewedAt:r.reviewed?new Date().toISOString():null}}));});
}
export async function publishPost(postId:string,command?:{requestKey:string;expectedDigest:string}):Promise<ActionResult<PublicationVerdict>> {
 if(!command)return {ok:false,error:'Publica la versión revisada desde el editor con su digest e identificador de operación.'};
 return attempt(async()=>{const result=await editorialService.publish(identity,{id:postId,...command});return result.verdict;});
}
export async function archivePost(postId:string):Promise<ActionResult> {return attempt(async()=>{await editorialService.setStatus(identity,{id:postId,status:'archived',requestKey:crypto.randomUUID()});});}
export async function setPostStatus(postId:string,status:'draft'|'needs-review'|'approved'):Promise<ActionResult> {
 if(status!=='draft')return {ok:false,error:'Usa las acciones explícitas de revisión de la versión privada.'};
 return unarchivePost(postId);
}
export async function changeSlug(postId:string,newSlugRaw:string):Promise<ActionResult<{slug:string}>> {
 const guard=await requireAdmin(undefined,{route:'blog:change-slug'});if(!guard.ok)return {ok:false,error:guard.error};
 const slug=newSlugRaw.trim().toLowerCase();if(!SLUG_RE.test(slug))return {ok:false,error:'Slug inválido.'};
 return attempt(async()=>{const r=await editorialService.read(identity,postId);await editorialService.save(identity,{id:r.id,requestKey:crypto.randomUUID(),expectedVersion:r.version,patch:{slug}});return {slug};});
}
