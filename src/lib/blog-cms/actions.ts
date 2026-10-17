'use server';

/**
 * Server Actions del Blog (WO-2026-00088, paridad Encino `src/app/actions/blog.ts`)
 * adaptadas a Pixeltec.mx: NextAuth (`requireUserSession` para leer/crear/
 * editar; `requireAdmin` para publicar/programar/archivar/eliminar/categorías —
 * política vigente del blog: lo que cambia visibilidad pública exige admin),
 * Drizzle sobre las MISMAS tablas del blog legacy, revisiones en
 * `blog_post_versions`, historial en `blog_activity`, revalidación de las
 * superficies públicas existentes.
 */
import { revalidatePath } from 'next/cache';
import { requireUserSession } from '@/lib/auth/session';
import { requireAdmin } from '@/lib/auth-guards';
import { getUserDisplayName,resolvePostRow } from '@/lib/blog/pg';
import { logBlogActivity } from '@/lib/blog/activity';
import { restoreVersion, listVersions, type BlogPostVersionMeta } from '@/lib/blog/versions';
import { generateSlug } from '@/lib/blog/ai/generate-post';
import type { ActionResult } from '@/lib/blog/schemas';
import { toPublicFailure } from '@/lib/errors/public-failure';
import {
  CreateCategorySchema,
  SaveBlogCmsPostSchema,
} from './schemas';
import { extractMapsEmbedUrl } from './maps-embed';
import { sanitizeBlogSchemaTypes } from './schema-types';
import {
  deleteBlogCategory,
  upsertBlogCategory,
} from './queries';
import { ADMIN_BLOG_PATH } from './paths';
import {editorialService,editorialSessionIdentity} from '@/lib/blog/editorial/host';

function revalidateBlogSurfaces(slugs: Array<string | null | undefined>) {
  revalidatePath('/blog');
  for (const s of slugs) if (s) revalidatePath(`/blog/${s}`);
  revalidatePath('/sitemap.xml');
  revalidatePath(ADMIN_BLOG_PATH);
}

function fail(err: unknown, code: string, message: string): ActionResult<never> {
  console.error(`[blog-cms] ${code}:`, err instanceof Error ? err.name : typeof err);
  return { ok: false, error: toPublicFailure(err, { code, message }).message };
}

// ── Crear ───────────────────────────────────────────────────────────────────

/** Crea un borrador vacío y devuelve su id (el editor se abre por redirect
 *  desde la UI). `modo: 'ia'` solo cambia el query string del destino. */
export async function createBlogCmsDraft(): Promise<ActionResult<{ id: string }>> {
  try {const result=await editorialService.createDraft(editorialSessionIdentity,{requestKey:crypto.randomUUID(),patch:{slug:'borrador-'+crypto.randomUUID().slice(0,8)}});return {ok:true,data:{id:result.id}};}
  catch(error){return {ok:false,error:'No se pudo crear el borrador privado.'};}
}

/** Descarta un borrador si sigue vacío (cerrar el wizard IA sin escribir). */
export async function discardEmptyBlogCmsDraft(postId: string): Promise<ActionResult<{ deleted: boolean }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return { ok: true, data: { deleted: false } };
  try {
    const deleted = await editorialService.discardEmpty(editorialSessionIdentity,postId);
    if (deleted) revalidatePath(ADMIN_BLOG_PATH);
    return { ok: true, data: { deleted } };
  } catch (err) {
    return fail(err, 'blog_cms_discard_failed', 'No se pudo descartar el borrador.');
  }
}

// ── Guardar (autosave / borrador / publicar / programar) ────────────────────

export interface SaveBlogCmsResult {
  id:string;version:string;digest:string;slug:string;status:string;
  publishedAt:string|null;scheduledAt:string|null;privateRevision:boolean;
}

export async function saveBlogCmsPost(raw: unknown): Promise<ActionResult<SaveBlogCmsResult>> {
  const parsed=SaveBlogCmsPostSchema.safeParse(raw);
  if(!parsed.success)return {ok:false,error:'Datos inválidos. Revisa los campos.'};
  const d=parsed.data;
  if(!d.requestKey||d.expectedVersion==null)return {ok:false,error:'Actualiza el editor para guardar con control de versión.'};
  try {
    const current=await editorialService.read(editorialSessionIdentity,d.id);
    const seo={...current.content.seo,metaTitle:(d.seoTitle??'').trim(),metaDescription:d.metaDescription.trim(),noindex:d.noindex??false,nofollow:d.nofollow??false,ogImageAlt:d.coverImageAlt??'',schemaTypes:sanitizeBlogSchemaTypes(d.schemaTypes??current.content.seo.schemaTypes)};
    const patch={title:d.title.trim(),excerpt:d.metaDescription.trim(),body:d.body,slug:generateSlug(d.slug)||generateSlug(d.title)||current.slug,category:d.newCategory?.trim()||d.category?.trim()||'',tags:[...new Set((d.tags??[]).map(t=>t.trim()).filter(Boolean))],faq:(d.faq??[]).filter(f=>f.question.trim()&&f.answer.trim()),coverImage:d.coverImage?.trim()||null,mapsEmbed:d.mapsEmbed?extractMapsEmbedUrl(d.mapsEmbed):null,seo,sources:d.sources??current.content.sources,internalLinks:d.internalLinks??current.content.internalLinks,ai:d.ai??current.content.ai,aiParams:d.aiParams??current.content.aiParams};
    let result=await editorialService.save(editorialSessionIdentity,{id:d.id,requestKey:d.requestKey,expectedVersion:d.expectedVersion,patch});
    if(d.intent==='publish'||d.intent==='schedule') {
      if(!d.expectedDigest||d.expectedDigest!==result.digest)return {ok:false,data:result,error:'Guarda y revisa esta versión antes de publicar.'};
      result=d.intent==='publish'
        ?await editorialService.publish(editorialSessionIdentity,{id:d.id,requestKey:d.requestKey,expectedDigest:d.expectedDigest})
        :await editorialService.schedule(editorialSessionIdentity,{id:d.id,requestKey:d.requestKey,expectedDigest:d.expectedDigest,slot:'cms:'+d.id+':'+d.expectedDigest,dueAt:d.scheduledAt});
    }
    revalidatePath(`${ADMIN_BLOG_PATH}/${d.id}/editar`);
    return {ok:true,data:result};
  }catch(error){return {ok:false,error:editorialFailure(error)};}
}

function editorialFailure(error:unknown):string {
  const code=error instanceof Error?error.message:'';
  if(/STALE|BASE_CHANGED/.test(code))return 'La versión cambió. Recarga y compara tus cambios antes de volver a guardar.';
  if(/REVIEW|PUBLICATION_GATE/.test(code))return 'Falta revisar esta versión, sus fuentes y afirmaciones antes de publicarla.';
  if(/ACCESS_DENIED|NOT_FOUND/.test(code))return 'No tienes acceso a esta entrada.';
  if(code==='SLUG_CONFLICT')return 'La URL ya está usada por otra entrada o una redirección histórica.';
  if(code==='IDEMPOTENCY_CONFLICT')return 'El identificador de la operación ya se usó con otros datos.';
  return 'No se pudo completar la operación editorial.';
}

/** Explicit human attestation from the authenticated admin editor. Not an MCP
 * tool and never invoked automatically by autosave, AI or publication. */
export async function reviewBlogCmsRevision(raw:unknown):Promise<ActionResult<{digest:string;reviewed:boolean}>> {
  const {z}=await import('zod');
  const schema=z.object({id:z.string().uuid(),expectedDigest:z.string().regex(/^[a-f0-9]{64}$/),requestKey:z.string().uuid(),verifiedSourceIds:z.array(z.string().min(1)).max(20),verifiedLinks:z.array(z.string().min(1)).max(20),claimsVerified:z.literal(true)}).strict();
  const parsed=schema.safeParse(raw);if(!parsed.success)return {ok:false,error:'Confirma la revisión de fuentes y afirmaciones.'};
  try{return {ok:true,data:await editorialService.review(editorialSessionIdentity,parsed.data)};}
  catch(error){return {ok:false,error:editorialFailure(error)};}
}

// ── Archivar / restaurar / eliminar ─────────────────────────────────────────

async function setStatusAsAdmin(postId: string, status: 'archived' | 'draft', route: string, message: string, type: 'archivado' | 'restaurado-archivo'): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route });
  if (!guard.ok) return { ok: false, error: guard.error };
  try {
    const result=await editorialService.setStatus(editorialSessionIdentity,{id:postId,status,requestKey:crypto.randomUUID()});
    revalidateBlogSurfaces([result.slug]);
    return { ok: true };
  } catch (err) {
    return fail(err, 'blog_cms_status_failed', 'No se pudo cambiar el estado.');
  }
}

export async function archiveBlogCmsPost(postId: string): Promise<ActionResult> {
  return setStatusAsAdmin(postId, 'archived', 'blog-cms:archive', 'Entrada archivada', 'archivado');
}

/** Restaura a BORRADOR (no al estado previo), como Encino. */
export async function unarchiveBlogCmsPost(postId: string): Promise<ActionResult> {
  return setStatusAsAdmin(postId, 'draft', 'blog-cms:unarchive', 'Restaurada del archivo como borrador', 'restaurado-archivo');
}

/** Eliminación DEFINITIVA (Encino no tiene papelera): revisiones, actividad,
 *  redirects y contador caen en cascada por FK. */
export async function deleteBlogCmsPost(postId: string): Promise<ActionResult> {
  return {ok:false,error:'Conserva el historial editorial: archiva la entrada para retirarla del sitio.'};
}

// ── Revisiones ──────────────────────────────────────────────────────────────

export async function listBlogCmsRevisions(postId: string, limit = 10): Promise<ActionResult<BlogPostVersionMeta[]>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  try {
    const owned=await editorialService.read(editorialSessionIdentity,postId);
    const all = await listVersions(owned.id);
    return { ok: true, data: all.slice(0, limit) };
  } catch (err) {
    return fail(err, 'blog_cms_versions_failed', 'No se pudieron cargar las revisiones.');
  }
}

/** Restaura contenido conservando slug/estado/fechas (semántica de Encino y
 *  del legacy `restoreVersion`); la restauración misma queda versionada. */
export async function restoreBlogCmsRevision(postId: string, versionId: string): Promise<ActionResult<{ restoredVersion: number }>> {
  const session = await requireUserSession();
  if (!session) return { ok: false, error: 'No autenticado' };
  try {
    const row = await resolvePostRow(postId);
    if (!row) return { ok: false, error: 'Entrada no encontrada' };
    const result = await restoreVersion(row.id, versionId, { id: session.userId, name: await getUserDisplayName(session.userId) });
    revalidateBlogSurfaces([row.slug]);
    return { ok: true, data: result };
  } catch (err) {
    return fail(err, 'blog_cms_restore_failed', 'No se pudo restaurar la revisión.');
  }
}

// ── Categorías ──────────────────────────────────────────────────────────────

export async function createBlogCmsCategory(raw: unknown): Promise<ActionResult<{ created: boolean }>> {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:category-create' });
  if (!guard.ok) return { ok: false, error: guard.error };
  const parsed = CreateCategorySchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: 'Nombre de categoría inválido.' };
  try {
    const { name, slug, parentId, description } = parsed.data;
    const created = await upsertBlogCategory(name, guard.uid, {
      slug: slug?.trim() ? generateSlug(slug) : generateSlug(name),
      parentId: parentId ?? null,
      description: (description ?? '').trim().slice(0, 500),
    });
    if (!created) return { ok: false, error: 'Ya existe una categoría con ese nombre.' };
    revalidatePath(`${ADMIN_BLOG_PATH}/categorias`);
    return { ok: true, data: { created } };
  } catch (err) {
    return fail(err, 'blog_cms_category_failed', 'No se pudo crear la categoría.');
  }
}

export async function deleteBlogCmsCategory(id: string): Promise<ActionResult> {
  const guard = await requireAdmin(undefined, { route: 'blog-cms:category-delete' });
  if (!guard.ok) return { ok: false, error: guard.error };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'Categoría inválida.' };
  try {
    await deleteBlogCategory(id);
    revalidatePath(`${ADMIN_BLOG_PATH}/categorias`);
    return { ok: true };
  } catch (err) {
    return fail(err, 'blog_cms_category_delete_failed', 'No se pudo eliminar la categoría.');
  }
}
