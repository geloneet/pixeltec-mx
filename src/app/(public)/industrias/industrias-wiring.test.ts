import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guardarraíl de cableado (patrón `home-wiring.test.ts`): los `page.tsx`
 * arrastran Header/Footer y next/navigation, así que se leen como texto.
 * L2 (WO-2026-00345): el hub y las páginas de industria consumen el registro
 * `@/lib/content/industrias`; el sitemap deriva las URLs del mismo registro.
 */
const hub = readFileSync(resolve(__dirname, 'page.tsx'), 'utf8');
const leaf = readFileSync(resolve(__dirname, '[slug]', 'page.tsx'), 'utf8');
const sitemap = readFileSync(resolve(__dirname, '..', '..', 'sitemap.ts'), 'utf8');

describe('src/app/industrias — cableado (WO-2026-00345 L2)', () => {
  it('renders approved catalog with initial structured data',()=>{
    expect(hub).toContain('<PublicPage path={path}/>');
    const catalog=JSON.parse(readFileSync(resolve(process.cwd(),'src/components/public-site/generated/pages.json'),'utf8'));
    expect(catalog['/industrias'].schemas.length).toBeGreaterThan(0);
    expect(JSON.stringify(catalog['/industrias'].body)).not.toContain('Distribución de agua');
  });

  it('la hoja es SSG cerrada: generateStaticParams + dynamicParams = false + notFound', () => {
    expect(leaf).toContain('export function generateStaticParams');
    expect(leaf).toContain('export const dynamicParams = false');
    expect(leaf).toContain('notFound()');
    expect(leaf).toContain('industriesWithPage');
    expect(leaf).toContain('<IndustryStructuredData');
    expect(leaf).toContain('<FAQPageStructuredData');
    expect(leaf).toContain('<BreadcrumbStructuredData');
    expect(leaf).toContain('<IndustryPage');
  });

  it('el sitemap deriva las páginas de industria del registro', () => {
    expect(sitemap).toContain("from '@/lib/content/industrias'");
    expect(sitemap).toContain('industriesWithPage()');
  });
});
