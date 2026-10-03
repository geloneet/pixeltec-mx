import Image from 'next/image';
import Link from 'next/link';
import { Search } from 'lucide-react';

export interface BlogSidebarData {
  recentPosts: { slug: string; title: string; imageUrl: string; date: string }[];
  categories: string[];
  tags: string[];
}

/** Navegación editorial de artículos publicados; no genera categorías ficticias. */
export function BlogSidebar({
  recentPosts,
  categories,
  tags,
  activeCategory = null,
  activeTag = null,
  searchQuery = '',
}: BlogSidebarData & {
  activeCategory?: string | null;
  activeTag?: string | null;
  searchQuery?: string;
}) {
  return (
    <aside className="sticky top-28 rounded-[1.5rem] border border-slate-200/90 bg-white p-6 dark:border-white/10 dark:bg-[#101824]">
      <form action="/blog" role="search" className="relative">
        <label htmlFor="blog-search" className="sr-only">Buscar artículos</label>
        <input
          id="blog-search"
          name="q"
          type="search"
          defaultValue={searchQuery}
          placeholder="Buscar artículos"
          className="w-full rounded-full border border-slate-200 bg-[#f8fafc] py-3 pl-4 pr-12 text-sm text-slate-950 outline-none focus:border-sky-500 dark:border-white/15 dark:bg-white/5 dark:text-white"
        />
        <button type="submit" aria-label="Buscar" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-sky-700 dark:text-slate-400 dark:hover:text-sky-300">
          <Search className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>

      {categories.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Categorías</h2>
          <ul className="mt-4 space-y-3">
            {categories.map((cat) => (
              <li key={cat}>
                <Link
                  href={`/blog?categoria=${encodeURIComponent(cat)}`}
                  className={`text-sm transition-colors hover:text-sky-700 dark:hover:text-sky-300 ${cat === activeCategory ? 'font-semibold text-sky-700 dark:text-sky-300' : 'text-slate-600 dark:text-slate-300'}`}
                >
                  {cat}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recentPosts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Artículos recientes</h2>
          <ul className="mt-5 space-y-4">
            {recentPosts.map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`} className="group flex items-start gap-3">
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/10">
                    <Image src={post.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-sm font-medium leading-5 text-slate-900 transition-colors group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">{post.title}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{post.date}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tags.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Temas</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/blog?etiqueta=${encodeURIComponent(tag)}`}
                className={`rounded-full px-3 py-1.5 text-xs transition-colors ${tag === activeTag ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-800 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-sky-400/20 dark:hover:text-sky-200'}`}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
