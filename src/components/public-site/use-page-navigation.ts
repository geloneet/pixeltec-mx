'use client';

import {useEffect, useRef} from 'react';
import {usePathname, useRouter} from 'next/navigation';

export function pageDestination(anchor: HTMLAnchorElement, current: string) {
  if (anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return null;
  const from = new URL(current);
  const to = new URL(anchor.href, current);
  if (to.origin !== from.origin || !/^https?:$/.test(to.protocol)) return null;
  if (to.pathname === from.pathname) return null;
  return to.pathname + to.search + to.hash;
}

/** A bounded, interruptible scroll: user input always wins over choreography. */
export function scrollToPageTop(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  if (window.scrollY < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({top: 0, behavior: 'instant'});
    return Promise.resolve(true);
  }
  return new Promise(resolve => {
    const start = window.scrollY;
    const duration = Math.min(900, Math.max(420, Math.sqrt(start) * 14));
    const begun = performance.now();
    let frame = 0;
    const finish = (complete: boolean) => {
      cancelAnimationFrame(frame);
      signal.removeEventListener('abort', abort);
      window.removeEventListener('wheel', abort);
      window.removeEventListener('touchstart', abort);
      window.removeEventListener('keydown', key);
      resolve(complete);
    };
    const abort = () => finish(false);
    const key = (event: KeyboardEvent) => {
      if (['Escape', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) abort();
    };
    const tick = (now: number) => {
      const p = Math.min(1, (now - begun) / duration);
      const eased = p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
      window.scrollTo({top: start * (1 - eased), behavior: 'instant'});
      if (p < 1) frame = requestAnimationFrame(tick); else finish(true);
    };
    signal.addEventListener('abort', abort, {once: true});
    window.addEventListener('wheel', abort, {passive: true});
    window.addEventListener('touchstart', abort, {passive: true});
    window.addEventListener('keydown', key);
    frame = requestAnimationFrame(tick);
  });
}

export function usePageNavigation() {
  const router = useRouter();
  const path = usePathname();
  const pending = useRef<AbortController | null>(null);
  const animation = useRef<Animation | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previous = useRef(path);

  useEffect(() => {
    const content = document.querySelector<HTMLElement>('[data-route-content]');
    clearTimeout(timeout.current);
    pending.current?.abort();
    animation.current?.cancel();
    content?.removeAttribute('aria-busy');
    if (previous.current !== path && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation.current = content?.animate(
        [{opacity: .15, transform: 'translateY(10px)'}, {opacity: 1, transform: 'none'}],
        {duration: 620, easing: 'cubic-bezier(.22,1,.36,1)'}
      ) ?? null;
    }
    previous.current = path;
    return () => {pending.current?.abort(); animation.current?.cancel(); clearTimeout(timeout.current);};
  }, [path]);

  return (anchor: HTMLAnchorElement) => {
    const href = pageDestination(anchor, location.href);
    if (!href) return false;
    pending.current?.abort();
    animation.current?.cancel();
    clearTimeout(timeout.current);
    const controller = new AbortController();
    pending.current = controller;
    const content = document.querySelector<HTMLElement>('[data-route-content]');
    router.prefetch(href);
    void (async () => {
      if (!await scrollToPageTop(controller.signal) || controller.signal.aborted) return;
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches && content) {
        const exit = content.animate([{opacity: 1}, {opacity: .15}], {duration: 180, fill: 'forwards'});
        animation.current = exit;
        try {await exit.finished;} catch {return;}
      }
      if (controller.signal.aborted) return;
      content?.setAttribute('aria-busy', 'true');
      router.push(href, {scroll: true});
      // A slow/failed request must never leave the current page faded or blocked.
      timeout.current = setTimeout(() => {animation.current?.cancel(); content?.removeAttribute('aria-busy');}, 8000);
    })();
    return true;
  };
}
