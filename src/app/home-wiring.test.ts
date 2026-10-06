import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `page.tsx` arrastra server actions y la base de datos al importarse, así que
 * este guardarraíl lee el archivo como texto: confirma que la portada monta lo
 * que WO-2026-00343 añadió, sin ejecutar nada. Si alguien quita un import, el
 * test lo dice por su nombre.
 */
const source = readFileSync(resolve(__dirname, '(public)', 'page.tsx'), 'utf8');

describe('Home production integration (WO-2026-00509)',()=>{
 it('emits canonical home structured data',()=>{expect(source).toMatch(/<HomeStructuredData\s*\/>/);expect(source).toContain('HOME_SEO.title');});
 it('loads published CMS posts on the server',()=>{expect(source).toContain('await homePosts()');expect(source).toContain('<Home posts={posts}/>');});
 it('contains server-renderable headings and local landing links',()=>{const compiled=readFileSync(resolve(__dirname,'../components/public-site/generated/home.jsx'),'utf8');expect(compiled).toContain('React.createElement("h1"');expect(compiled).toContain('React.createElement("h2"');expect(compiled).toContain('/desarrollo-web-puerto-vallarta/');expect(compiled).not.toContain('extends DCLogic');expect(compiled).not.toContain('new Function');});
});
