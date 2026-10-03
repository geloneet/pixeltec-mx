import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { EditorialCard, type EditorialCardData } from '@/components/blog/editorial-card';
import { formatEditorialDate } from '@/lib/blog/format-date';

async function recentArticles(): Promise<{ posts: EditorialCardData[]; unavailable: boolean }> {
  try {
    const { getRecentPublishedPosts } = await import('@/lib/blog/queries/posts');
    const posts = await getRecentPublishedPosts(3);
    return { posts: posts.map((post) => ({
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      imageUrl: post.coverImage ?? '/og-image.png',
      date: formatEditorialDate(post.publishedAt),
      readTime: `${post.readingTimeMin} min de lectura`,
      author: post.author.name,
    })), unavailable: false };
  } catch (error) {
    console.error('[home/blog] recent articles unavailable:', error);
    return { posts: [], unavailable: true };
  }
}

export async function HomeBlogSection() {
  const { posts, unavailable } = await recentArticles();

  return (
    <section aria-labelledby="home-blog-heading" className="bg-[#f5f7fa] py-20 text-slate-950 dark:bg-[#080d16] dark:text-white sm:py-28">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full bg-sky-100 px-5 py-2 text-sm font-medium text-sky-900 dark:bg-sky-400/15 dark:text-sky-200">Blog</span>
          <h2 id="home-blog-heading" className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Ideas para avanzar con tecnología
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
            Guías y perspectivas sobre software, automatización y tecnología aplicada a empresas reales.
          </p>
        </header>

        {posts.length > 0 ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => <EditorialCard key={post.id} post={post} />)}
          </div>
        ) : (
          <p className="mx-auto mt-12 max-w-xl rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-[#101824] dark:text-slate-300">
            {unavailable ? 'No pudimos cargar las publicaciones en este momento. Inténtalo de nuevo más tarde.' : 'Estamos preparando nuevas publicaciones. Explora el blog para ver el contenido disponible.'}
          </p>
        )}

        <div className="mt-12 text-center">
          <Link href="/blog" className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-800 dark:bg-white dark:text-slate-950 dark:hover:bg-sky-100">
            Explorar el blog <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
