import Lenis from 'lenis';
const preference = matchMedia('(prefers-reduced-motion: reduce)');
let engine: Lenis | undefined;
let frame = 0;
function tick(time: number): void {
  engine?.raf(time);
  frame = requestAnimationFrame(tick);
}
function stop(): void {
  cancelAnimationFrame(frame);
  engine?.destroy();
  engine = undefined;
}
function start(): void {
  if (engine || preference.matches || document.hidden) return;
  engine = new Lenis({ duration: 1.1, easing: t => 1 - Math.pow(1 - t, 3), smoothWheel: true, wheelMultiplier: 1.15, touchMultiplier: 1.5, syncTouch: true, syncTouchLerp: 0.06, touchInertiaMultiplier: 28, autoResize: true,
    prevent: node => Boolean(node.closest('dialog, #home-menu, [data-lenis-prevent]'))
  });
  frame = requestAnimationFrame(tick);
}
start();
preference.addEventListener('change', () => { stop(); start(); });
window.addEventListener('pagehide', stop);
window.addEventListener('pageshow', start);
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
document.addEventListener('click', event => {
  if (event.defaultPrevented || !(event.target instanceof Element) || !engine) return;
  const anchor = event.target.closest<HTMLAnchorElement>('a[href^="#"]');
  const id = anchor?.getAttribute('href')?.slice(1);
  if (!id || anchor?.closest('dialog')) return;
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  engine.scrollTo(target, { offset: -110, duration: 1.1 });
  history.pushState(null, '', `#${id}`);
});
