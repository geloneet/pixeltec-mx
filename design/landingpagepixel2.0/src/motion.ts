/** Optional motion: content stays visible if scripts or browser APIs are unavailable. */
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
const running = new Map<Element, Animation>();
const seen = new WeakSet<Element>();
const ease = 'cubic-bezier(.22, 1, .36, 1)';

export function enter(element: HTMLElement | null | undefined, delay = 0): void {
  if (!element || reduced.matches || element.hidden || typeof element.animate !== 'function') return;
  running.get(element)?.cancel();
  const animation = element.animate([
    { opacity: 0, translate: '0 18px' },
    { opacity: 1, translate: '0 0' }
  ], { duration: 640, delay, easing: ease, fill: 'backwards' });
  running.set(element, animation);
  const clean = (): void => { if (running.get(element) === animation) running.delete(element); };
  animation.addEventListener('finish', clean, { once: true });
  animation.addEventListener('cancel', clean, { once: true });
}

export function panelMotion(element: HTMLElement, opening: boolean): Animation | undefined {
  if (reduced.matches || typeof element.animate !== 'function') return;
  running.get(element)?.cancel();
  const animation = element.animate(opening ? [
    { opacity: 0, translate: '36px 0' }, { opacity: 1, translate: '0 0' }
  ] : [
    { opacity: 1, translate: '0 0' }, { opacity: 0, translate: '20px 0' }
  ], { duration: opening ? 420 : 180, easing: ease });
  running.set(element, animation);
  const clean = (): void => { if (running.get(element) === animation) running.delete(element); };
  animation.addEventListener('finish', clean, { once: true });
  animation.addEventListener('cancel', clean, { once: true });
  return animation;
}

const selector = '[data-motion], .hero-overline, .page-hero h1, .hero-bottom, .section-head, .service-row, .work-card, .feature-grid>article, .process-grid>article, .team-grid>article, .method-list>article, .about-visual, .manifesto, .detail-art, .detail-sidebar, .cta-section, .footer-top, .footer-grid';
const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  let order = 0;
  for (const entry of entries) {
    if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
    observer?.unobserve(entry.target);
    enter(entry.target, Math.min(order++ * 55, 165));
  }
}, { threshold: 0, rootMargin: '0px 0px -16px 0px' }) : null;

function discover(): void {
  document.querySelectorAll<HTMLElement>(selector).forEach(element => {
    // Never animate a second nested reveal, or the original cube/physics surfaces.
    if (element.closest('x-dc') || seen.has(element) || element.parentElement?.closest(selector)) return;
    seen.add(element);
    // The document transition already reveals the first viewport; avoid a second fade from empty.
    if(document.documentElement.dataset.routeArrival&&element.getBoundingClientRect().top<innerHeight) return;
    if (!reduced.matches) observer?.observe(element);
  });
}
discover();
// The supplied homepage renders asynchronously through its existing DC runtime.
if (document.body.hasAttribute('data-pixel-home')) {
  const hasRenderedHome = (): boolean => Array.from(document.querySelectorAll('header nav')).some(nav => !nav.closest('x-dc'));
  const mount = new MutationObserver(() => {
    if (!hasRenderedHome()) return;
    discover();
    mount.disconnect();
  });
  if (!hasRenderedHome()) mount.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('focusin', event => {
  if (!(event.target instanceof Element)) return;
  for (const [element, animation] of running) {
    if (element.contains(event.target)) animation.cancel();
  }
  const target = event.target.closest(selector);
  if (target) observer?.unobserve(target);
});
reduced.addEventListener('change', () => {
  if (!reduced.matches) return;
  observer?.disconnect();
  for (const animation of running.values()) animation.cancel();
  running.clear();
});
window.addEventListener('pagehide', () => {
  for (const animation of running.values()) animation.cancel();
  running.clear();
});

// Decorative service loops never run off-screen or while the document is hidden.
const serviceArt = Array.from(document.querySelectorAll<HTMLElement>('.service-art .art'));
const visibleArt = new Set<Element>();
function syncServiceArt(): void {
  for (const art of serviceArt) art.classList.toggle('art-active', visibleArt.has(art) && !document.hidden && !reduced.matches);
}
const artObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (entry.isIntersecting) visibleArt.add(entry.target);
    else visibleArt.delete(entry.target);
  }
  syncServiceArt();
}, { threshold: .1 }) : null;
serviceArt.forEach(art => artObserver?.observe(art));
document.addEventListener('visibilitychange', syncServiceArt);
reduced.addEventListener('change', syncServiceArt);
window.addEventListener('pagehide', () => serviceArt.forEach(art => art.classList.remove('art-active')));
window.addEventListener('pageshow', syncServiceArt);
