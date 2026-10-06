// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from 'vitest';
import {pageDestination, scrollToPageTop} from './use-page-navigation';

describe('public navigation boundaries', () => {
  const current = 'https://pixeltec.mx/services';
  const link = (href: string) => {const a=document.createElement('a');a.href=href;return a;};
  it('preserves native same-page anchors and query filters', () => {
    expect(pageDestination(link(current+'#contenido'),current)).toBeNull();
    expect(pageDestination(link(current+'?category=web'),current)).toBeNull();
  });
  it('leaves external, contact, downloads and new tabs alone', () => {
    for(const href of ['https://wa.me/123','mailto:contacto@pixeltec.mx','tel:123']) expect(pageDestination(link(href),current)).toBeNull();
    const a=link('https://pixeltec.mx/about');a.target='_blank';expect(pageDestination(a,current)).toBeNull();
    a.target='';a.download='file';expect(pageDestination(a,current)).toBeNull();
  });
  it('retains a destination hash across a page change', () => {
    expect(pageDestination(link('https://pixeltec.mx/about#equipo'),current)).toBe('/about#equipo');
  });
});

describe('interruptible top scroll', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('does not move after cancellation', async () => {
    const controller=new AbortController();controller.abort();
    expect(await scrollToPageTop(controller.signal)).toBe(false);
  });
  it('cancels the pending frame when the visitor scrolls', async () => {
    vi.stubGlobal('scrollY',1200);vi.stubGlobal('matchMedia',()=>({matches:false}));
    vi.stubGlobal('requestAnimationFrame',vi.fn(()=>42));const cancel=vi.fn();vi.stubGlobal('cancelAnimationFrame',cancel);
    const pending=scrollToPageTop(new AbortController().signal);
    window.dispatchEvent(new Event('wheel'));
    expect(await pending).toBe(false);expect(cancel).toHaveBeenCalledWith(42);
  });
  it('honors reduced motion without scheduling animation', async () => {
    vi.stubGlobal('scrollY',1200);vi.stubGlobal('matchMedia',()=>({matches:true}));
    const scroll=vi.fn();vi.stubGlobal('scrollTo',scroll);
    expect(await scrollToPageTop(new AbortController().signal)).toBe(true);
    expect(scroll).toHaveBeenCalledWith({top:0,behavior:'instant'});
  });
});
