import Link from "next/link";
import { formatEditorialDate } from "@/lib/blog/format-date";
import { BlogGrid, type BlogCardData } from "./blog-grid";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { CollectionPageStructuredData, BreadcrumbStructuredData } from "@/components/seo/structured-data";
import { SITE } from "@/lib/site-config";
import { BlogSidebar } from "@/components/blog/blog-sidebar";

export const revalidate = 3600; // ISR: regenerar máximo cada hora

// WO-2026-00213: título/H1 genéricos ("Insights & Tecnología") no explicaban
// a Google ni al usuario qué encontrarían — propuesta de Miguel reemplaza
// marca por intención de búsqueda real (PyMEs, IA, software, automatización).
// L3 (WO-2026-00345): el title anterior sumaba 79 caracteres con « | PixelTEC»
// y llevaba doble separador; misma intención en ≤ 60.
const BLOG_INDEX_TITLE = 'Blog: IA, software y automatización para pymes';
const BLOG_INDEX_DESCRIPTION = 'Guías, comparativas, calculadoras y casos reales sobre automatización con IA, software a medida y desarrollo de aplicaciones en México.';

export const metadata: Metadata = buildMetadata({
  path: '/blog',
  title: BLOG_INDEX_TITLE,
  description: BLOG_INDEX_DESCRIPTION,
});

/** Paridad Encino (WO-2026-00088): filtros por query `?categoria=` / `?etiqueta=`
 *  (en memoria sobre los publicados; sin páginas públicas por categoría/tag). */
interface PublicFilters {
  categoria: string;
  etiqueta: string;
  q: string;
}

interface PublishedIndex {
  cards: BlogCardData[];
  categories: string[];
  tags: string[];
  recentPosts: { slug: string; title: string; imageUrl: string; date: string }[];
  unavailable: boolean;
}

async function getPublishedCards(filters: PublicFilters): Promise<PublishedIndex> {
  try {
    const { getPublishedPosts, getBlogSidebarData } = await import("@/lib/blog/queries/posts");
    // Barrido de programados (paridad Encino): un post `scheduled` vencido se
    // publica en la siguiente regeneración ISR de esta página.
    const { publishDueScheduledPosts } = await import("@/lib/blog-cms/queries");
    await publishDueScheduledPosts().catch(() => []);
    const all = await getPublishedPosts();
    const categories = Array.from(new Set(all.map((p) => p.category).filter(Boolean))).sort();
    const tags = Array.from(new Set(all.flatMap((p) => p.tags).filter(Boolean))).slice(0, 20);
    const posts = all.filter(
      (p) =>
        (!filters.categoria || p.category === filters.categoria) &&
        (!filters.etiqueta || p.tags.includes(filters.etiqueta)) &&
        (!filters.q || `${p.title} ${p.excerpt} ${p.category} ${p.tags.join(' ')}`.toLocaleLowerCase('es').includes(filters.q.toLocaleLowerCase('es'))),
    );
    const cards = posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      category: p.category,
      // Portada local por defecto: mismo criterio que /blog/[slug] — un
      // placeholder externo (placehold.co) mete un tercer origen en la ruta
      // crítica del LCP del listado.
      imageUrl: p.coverImage ?? "/og-image.png",
      date: formatEditorialDate(p.publishedAt),
      readTime: `${p.readingTimeMin} min de lectura`,
      author: p.author.name,
    }));
    // WO-2026-00212: sidebar (Entradas recientes/Categorías/Etiquetas) —
    // recentPosts SIEMPRE sobre lo publicado sin filtrar (paridad Encino: la
    // barra no cambia cuando el listado se filtra por categoría/etiqueta).
    const { recentPosts } = await getBlogSidebarData();
    return { cards, categories, tags, recentPosts, unavailable: false };
  } catch (error) {
    console.error('[blog/list] getPublishedCards failed:', error);
    return { cards: [], categories: [], tags: [], recentPosts: [], unavailable: true };
  }
}

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.slice(0, 80) ?? "";
}

export default async function BlogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const filters: PublicFilters = { categoria: one(sp.categoria), etiqueta: one(sp.etiqueta), q: one(sp.q).trim() };
  const { cards: posts, categories, tags, recentPosts, unavailable } = await getPublishedCards(filters);
  const activeFilter = filters.categoria || filters.etiqueta || filters.q;

  return (
    <>
      <CollectionPageStructuredData
        name={BLOG_INDEX_TITLE}
        description={BLOG_INDEX_DESCRIPTION}
        path="/blog"
      />
      <BreadcrumbStructuredData items={[
        { name: SITE.name, url: SITE.url },
        { name: 'Blog', url: `${SITE.url}/blog` },
      ]} />
      {/* Header/Footer los monta blog/layout.tsx (compartidos con el detalle) */}
      <main className="min-h-screen bg-[#f5f7fa] text-slate-950 dark:bg-[#080d16] dark:text-white pt-32 sm:pt-40 pb-20 sm:pb-28">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <header className="mx-auto mb-14 max-w-3xl text-center md:mb-20">
            <span className="inline-flex rounded-full bg-sky-100 px-5 py-2 text-sm font-medium text-sky-900 dark:bg-sky-400/15 dark:text-sky-200">Blog</span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-5xl lg:text-6xl">
              Ideas para avanzar con tecnología
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              {BLOG_INDEX_DESCRIPTION}
            </p>
          </header>

          <div className="mb-8 lg:hidden">
            <form action="/blog" className="flex gap-2">
              <label htmlFor="blog-search-mobile" className="sr-only">Buscar artículos</label>
              <input id="blog-search-mobile" name="q" type="search" defaultValue={filters.q} placeholder="Buscar artículos" className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-950 outline-none focus:border-sky-500 dark:border-white/15 dark:bg-[#101824] dark:text-white" />
              <button type="submit" className="rounded-full bg-slate-950 px-5 text-sm font-medium text-white dark:bg-white dark:text-slate-950">Buscar</button>
            </form>
          </div>

          {(categories.length > 0 || tags.length > 0 || activeFilter) && (
            <nav aria-label="Filtrar artículos" className="mb-8 flex flex-wrap items-center gap-2 text-sm lg:mb-10">
              {activeFilter && (
                <Link href="/blog" className="rounded-full border border-slate-300 px-4 py-2 text-slate-700 hover:text-slate-950 dark:border-white/20 dark:text-slate-300 dark:hover:text-white">
                  ✕ {filters.categoria ? `Categoría: ${filters.categoria}` : filters.etiqueta ? `Etiqueta: ${filters.etiqueta}` : `Búsqueda: ${filters.q}`}
                </Link>
              )}
              {categories.map((c) => (
                <Link key={`c-${c}`} href={`/blog?categoria=${encodeURIComponent(c)}`} className={`rounded-full px-4 py-2 lg:hidden ${filters.categoria === c ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'bg-white text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                  {c}
                </Link>
              ))}
              {tags.map((t) => (
                <Link key={`t-${t}`} href={`/blog?etiqueta=${encodeURIComponent(t)}`} className={`rounded-full px-4 py-2 lg:hidden ${filters.etiqueta === t ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'border border-slate-200 bg-white text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>
                  #{t}
                </Link>
              ))}
            </nav>
          )}

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10">
            <section aria-labelledby="blog-posts-heading">
              <h2 id="blog-posts-heading" className="sr-only">Artículos del blog</h2>
              <BlogGrid posts={posts} unavailable={unavailable} />
            </section>
            <div className="hidden lg:block">
              <BlogSidebar
                recentPosts={recentPosts}
                categories={categories}
                tags={tags}
                activeCategory={filters.categoria || null}
                activeTag={filters.etiqueta || null}
                searchQuery={filters.q}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
