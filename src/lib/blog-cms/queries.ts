// Blog (WO-2026-00088, paridad Encino) — capa de lectura/escritura sobre las
// MISMAS tablas del blog legacy (D-C Opción A). Sin cliente de BD paralelo:
// todo pasa por `@/lib/db`. Las funciones son server-only por importar `db`.
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { blogCategories, blogPosts, postRedirects,editorialDrafts,editorialCommands } from '@/lib/db/schema';
import { serializePost } from '@/lib/blog/queries/posts';
import type { BlogPostSerialized } from '@/lib/blog/types';

export type BlogCmsStatusTab = 'all' | 'published' | 'scheduled' | 'draft' | 'archived';

export const PAGE_SIZE = 20;

export interface AdminPostsFilter {
  ownerId?:string;
  status?: BlogCmsStatusTab;
  category?: string;
  /** `YYYY-MM` sobre coalesce(published_at, updated_at). */
  month?: string;
  search?: string;
  page?: number;
}

/** Estados «vivos» del flujo Encino. El legacy `needs-review`/`approved` se
 *  muestra en «Todas» como borradores en revisión (no se pierden). */
function statusCondition(tab: BlogCmsStatusTab | undefined,ownerId?:string) {
  switch (tab) {
    case 'published':
      return and(eq(blogPosts.status,'published'),ownerId?sql`not (${scheduledFor(ownerId)})`:undefined);
    case 'scheduled':
      return ownerId?or(eq(blogPosts.status,'scheduled'),scheduledFor(ownerId)):eq(blogPosts.status,'scheduled');
    case 'draft':
      return and(inArray(blogPosts.status, ['draft', 'needs-review', 'approved']),ownerId?sql`not (${scheduledFor(ownerId)})`:undefined);
    case 'archived':
      return eq(blogPosts.status, 'archived');
    default:
      return undefined;
  }
}

function scheduledFor(ownerId:string){return sql`exists(select 1 from mcp_safety_candidate.editorial_commands c where c.draft_id=${blogPosts.id} and c.owner_id=${ownerId} and c.kind='publish' and c.state='queued')`;}

const monthExpr = sql<string>`to_char(date_trunc('month', coalesce(${blogPosts.publishedAt}, ${blogPosts.updatedAt})), 'YYYY-MM')`;
// Explicit empty-draft discard keeps FK/command history but leaves the CMS.
const notDiscarded = sql`not exists(select 1 from mcp_safety_candidate.editorial_drafts d where d.id=${blogPosts.id} and d.content ? 'discardedAt')`;

function whereFor(filter: AdminPostsFilter) {
  const conds = [
    notDiscarded,
    statusCondition(filter.status,filter.ownerId),
    filter.ownerId?sql`${blogPosts.author}->>'uid'=${filter.ownerId}`:undefined,
    filter.category ? eq(blogPosts.category, filter.category) : undefined,
    filter.month && /^\d{4}-\d{2}$/.test(filter.month) ? sql`${monthExpr} = ${filter.month}` : undefined,
    filter.search ? or(ilike(blogPosts.title, `%${filter.search}%`), ilike(blogPosts.slug, `%${filter.search}%`)) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);
  return conds.length ? and(...conds) : undefined;
}

export async function listBlogCmsPosts(filter: AdminPostsFilter): Promise<{ posts: BlogPostSerialized[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const where = whereFor(filter);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.updatedAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(blogPosts).where(where),
  ]);
  if(!filter.ownerId||!rows.length)return {posts:rows.map(serializePost),total:Number(total)};
  const drafts=await db.select({targetPostId:editorialDrafts.targetPostId,content:editorialDrafts.content,updatedAt:editorialDrafts.updatedAt}).from(editorialDrafts).where(and(eq(editorialDrafts.ownerId,filter.ownerId),inArray(editorialDrafts.id,rows.map(r=>r.id))));
  const queued=await db.select({id:editorialCommands.draftId,dueAt:editorialCommands.dueAt}).from(editorialCommands).where(and(eq(editorialCommands.ownerId,filter.ownerId),eq(editorialCommands.state,'queued'),inArray(editorialCommands.draftId,rows.map(r=>r.id))));
  const scheduled=new Map(queued.map(c=>[c.id,c.dueAt]));
  const byId=new Map(drafts.map(d=>[d.targetPostId,d]));
  return {posts:rows.map(row=>{const draft=byId.get(row.id);const content=(draft?.content as {fields?:Record<string,unknown>}|undefined)?.fields;return {...serializePost(content?{...row,...content,updatedAt:draft!.updatedAt} as typeof row:row),id:row.id,...(scheduled.has(row.id)?{status:'scheduled' as const,scheduledAt:scheduled.get(row.id)?.toISOString()??null}:{})};}),total:Number(total)};
}

export async function countBlogCmsPostsByStatus(ownerId?:string):Promise<Record<string,number>> {
  const state=ownerId?sql<string>`case when ${scheduledFor(ownerId)} then 'scheduled' else ${blogPosts.status} end`:blogPosts.status;
  // Calcular la expresión correlacionada una vez: SELECT/GROUP BY con binds
  // distintos no son la misma expresión para PostgreSQL, aunque su valor coincida.
  const scoped=db.select({status:sql<string>`${state}`.as('effective_status')}).from(blogPosts)
    .where(and(notDiscarded,ownerId?sql`${blogPosts.author}->>'uid'=${ownerId}`:undefined)).as('scoped_blog_status');
  const rows=await db.select({status:scoped.status,n:count()}).from(scoped).groupBy(scoped.status);
  return Object.fromEntries(rows.map(r=>[r.status,Number(r.n)]));
}

export async function listBlogCmsMonths(): Promise<string[]> {
  const rows = await db
    .select({ month: monthExpr })
    .from(blogPosts)
    .where(notDiscarded)
    .groupBy(monthExpr)
    .orderBy(desc(monthExpr));
  return rows.map((r) => r.month).filter(Boolean);
}

// Compatibility shim for existing render callers. GET/render MUST NOT publish.
// A durable explicit command runner will replace the old opportunistic sweep.
// Keeping this no-op prevents public article/sitemap reads from writing data.
export async function publishDueScheduledPosts(_opts: { force?: boolean; now?: Date } = {}): Promise<string[]> {
  return [];
}

/** @deprecated no in-memory scheduler remains. */
export function resetScheduledSweepThrottle(): void {}

// ── Borradores vacíos (paridad Encino `deleteAbandonedEmptyDrafts`/`deleteBlogPostIfEmpty`) ──

const EMPTY_BODY = sql`btrim(regexp_replace(${blogPosts.body}, '\\s', '', 'g')) = ''`;
const EMPTY_DRAFT = and(
  eq(blogPosts.status, 'draft'),
  sql`btrim(${blogPosts.title}) = ''`,
  EMPTY_BODY,
  isNull(blogPosts.coverImage),
);

/** Borra borradores sin título, sin cuerpo y sin portada abandonados hace más de
 *  10 minutos (las revisiones/actividad caen en cascada). Devuelve cuántos. */
export async function deleteAbandonedEmptyDrafts(): Promise<number> {
  // Compatibility shim for the admin list GET. Cleanup is an explicit command,
  // never an incidental consequence of someone opening a page.
  return 0;
}

/** Borra UN borrador si sigue vacío (al cerrar el wizard IA sin escribir). */
export async function deleteBlogPostIfEmpty(id: string): Promise<boolean> {
  // Call the authenticated common service via discardEmptyBlogCmsDraft.
  // This legacy unscoped helper is retained as a read-safe compatibility stub.
  return false;
}

// ── Slug único (misma regla que el legacy: -2, -3…; evita redirects históricos) ──

export async function uniqueBlogSlug(base: string, excludePostId?: string): Promise<string> {
  let candidate = base;
  for (let i = 2; ; i++) {
    const clashWhere = excludePostId
      ? and(eq(blogPosts.slug, candidate), sql`${blogPosts.id} <> ${excludePostId}`)
      : eq(blogPosts.slug, candidate);
    const [clash] = await db.select({ id: blogPosts.id }).from(blogPosts).where(clashWhere).limit(1);
    const [redirectClash] = await db
      .select({ fromSlug: postRedirects.fromSlug })
      .from(postRedirects)
      .where(eq(postRedirects.fromSlug, candidate))
      .limit(1);
    if (!clash && !redirectClash) return candidate;
    if (i > 50) throw new Error('No se pudo generar una URL única.');
    candidate = `${base}-${i}`;
  }
}

// ── Categorías ──────────────────────────────────────────────────────────────

export interface BlogCategoryDto {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  parentName: string | null;
  description: string;
  postCount: number;
}

export async function listBlogCategoryNames(): Promise<string[]> {
  const rows = await db.select({ name: blogCategories.name }).from(blogCategories).orderBy(blogCategories.name);
  return rows.map((r) => r.name);
}

export async function listBlogCategoriesWithUsage(): Promise<BlogCategoryDto[]> {
  const [cats, usage] = await Promise.all([
    db.select().from(blogCategories).orderBy(blogCategories.name),
    db.select({ category: blogPosts.category, n: count() }).from(blogPosts).where(notDiscarded).groupBy(blogPosts.category),
  ]);
  const byName = new Map(usage.map((u) => [u.category, Number(u.n)]));
  const byId = new Map(cats.map((c) => [c.id, c.name]));
  return cats.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    parentName: c.parentId ? (byId.get(c.parentId) ?? null) : null,
    description: c.description,
    postCount: byName.get(c.name) ?? 0,
  }));
}

/** Crea la categoría si no existe (nunca actualiza una existente, como Encino).
 *  Devuelve true solo si se creó. */
export async function upsertBlogCategory(
  name: string,
  createdBy: string | null,
  extra: { slug?: string; parentId?: string | null; description?: string } = {},
): Promise<boolean> {
  const rows = await db
    .insert(blogCategories)
    .values({
      name,
      slug: extra.slug ?? '',
      parentId: extra.parentId ?? null,
      description: extra.description ?? '',
      createdBy,
    })
    .onConflictDoNothing({ target: blogCategories.name })
    .returning({ id: blogCategories.id });
  return rows.length > 0;
}

export async function deleteBlogCategory(id: string): Promise<boolean> {
  const rows = await db.delete(blogCategories).where(eq(blogCategories.id, id)).returning({ id: blogCategories.id });
  return rows.length > 0;
}

/** Posts (título/estado/slug) de una categoría para el diálogo «N entradas». */
export async function listPostsInCategory(category: string, limit = 500): Promise<Array<{ id: string; title: string; status: string; slug: string }>> {
  const rows = await db
    .select({ id: blogPosts.id, title: blogPosts.title, status: blogPosts.status, slug: blogPosts.slug })
    .from(blogPosts)
    .where(eq(blogPosts.category, category))
    .orderBy(desc(blogPosts.updatedAt))
    .limit(limit);
  return rows;
}
