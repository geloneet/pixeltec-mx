import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe, expect, it, vi} from 'vitest';
vi.mock('server-only', () => ({}));
import MarkdownRenderer from './markdown-renderer';

describe('public article server rendering', () => {
  it('delivers readable article HTML and stable heading anchors without hydration', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'# Mi negocio\n\nContenido **importante**.\n\n## Un proceso claro'} />);
    expect(html).not.toContain('<h1');
    expect(html).toContain('id="un-proceso-claro"');
    expect(html).toContain('<strong>importante</strong>');
  });
  it('preserves sanitization at the public rendering boundary', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'<script>alert(1)</script>\n\n<img src="/foto.png" onerror="alert(2)">\n\n<a href="javascript:alert(3)">Enlace</a>'} />);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Enlace');
  });
  it('keeps tables readable in the initial HTML', () => {
    const html = renderToStaticMarkup(<MarkdownRenderer content={'| Etapa | Objetivo |\n| --- | --- |\n| Diagnóstico | Entender |'} />);
    expect(html).toContain('<table');
    expect(html).toContain('Diagnóstico');
    expect(html).toContain('Entender');
  });
});
