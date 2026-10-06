export const CUBE_POSTER = '/assets/brand/cube-poster-hq-768.webp';
export const CUBE_POSTER_SET = '/assets/brand/cube-poster-hq-768.webp 768w, /assets/brand/cube-poster-hq-1536.webp 1536w';
export const CUBE_POSTER_SIZES = '(max-width: 700px) 90vw, 50vw';

/** Discover the responsive hero image before the home content and client bundle. */
export function CubePosterPreload() {
  return <link rel="preload" as="image" href={CUBE_POSTER}
    imageSrcSet={CUBE_POSTER_SET} imageSizes={CUBE_POSTER_SIZES} fetchPriority="high" />;
}
