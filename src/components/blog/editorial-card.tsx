import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export interface EditorialCardData {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  imageUrl: string;
  date: string;
  readTime: string;
  author: string;
}

export function EditorialCard({
  post,
  layout = 'vertical',
}: {
  post: EditorialCardData;
  layout?: 'vertical' | 'horizontal';
}) {
  const horizontal = layout === 'horizontal';

  return (
    <article
      className={`group overflow-hidden rounded-[1.5rem] border border-slate-200/90 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.3)] transition-shadow hover:shadow-[0_20px_55px_-32px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[#101824] dark:shadow-none ${horizontal ? 'md:grid md:min-h-[280px] md:grid-cols-[42%_1fr]' : 'flex h-full flex-col'}`}
    >
      <Link
        href={`/blog/${post.slug}`}
        aria-label={`Leer ${post.title}`}
        className={`relative block overflow-hidden ${horizontal ? 'aspect-[16/10] md:aspect-auto md:min-h-[280px]' : 'aspect-[16/10]'}`}
      >
        <Image
          src={post.imageUrl}
          alt={post.title}
          fill
          sizes={horizontal ? '(max-width: 768px) 100vw, 40vw' : '(max-width: 768px) 100vw, 33vw'}
          className="object-cover transition-transform duration-500 group-hover:scale-[1.035]"
        />
      </Link>

      <div className={`flex flex-1 flex-col ${horizontal ? 'p-6 sm:p-7 lg:p-9' : 'p-6'}`}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
          {post.category && (
            <span className="rounded-full bg-sky-100 px-3 py-1 font-medium text-sky-900 dark:bg-sky-400/15 dark:text-sky-200">
              {post.category}
            </span>
          )}
          <span>{post.date}</span>
          <span aria-hidden="true">·</span>
          <span>{post.readTime}</span>
        </div>

        <h3 className={`mt-5 font-semibold leading-snug tracking-tight text-slate-950 dark:text-white ${horizontal ? 'text-2xl sm:text-[1.7rem]' : 'text-xl sm:text-2xl'}`}>
          <Link href={`/blog/${post.slug}`} className="transition-colors hover:text-sky-700 dark:hover:text-sky-300">
            {post.title}
          </Link>
        </h3>
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {post.excerpt}
        </p>
        <div className="mt-auto flex items-center justify-between gap-4 pt-7">
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{post.author}</span>
          <Link
            href={`/blog/${post.slug}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-white/15 dark:text-white dark:hover:border-sky-300 dark:hover:text-sky-300"
          >
            Leer artículo <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
