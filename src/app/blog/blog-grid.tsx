import { EditorialCard, type EditorialCardData } from '@/components/blog/editorial-card';

export type BlogCardData = EditorialCardData;

export function BlogGrid({ posts, unavailable = false }: { posts: BlogCardData[]; unavailable?: boolean }) {
  if (posts.length === 0) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-20 text-center dark:border-white/10 dark:bg-[#101824]">
        <p className="text-xl font-semibold text-slate-950 dark:text-white">{unavailable ? 'No pudimos cargar los artículos' : 'Aún no hay artículos para mostrar'}</p>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-400">
          {unavailable ? 'Inténtalo de nuevo más tarde.' : 'Prueba otra búsqueda o vuelve pronto para leer nuestras próximas publicaciones.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.map((post) => <EditorialCard key={post.id} post={post} layout="horizontal" />)}
    </div>
  );
}
