// Read-only release smoke. Never submits forms or sends messages.
import { readFile, writeFile } from 'node:fs/promises';
const base = new URL(process.argv[2] || 'http://localhost:4320');
if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Expected HTTP(S) origin');
const catalog = JSON.parse(await readFile(new URL('../../src/components/public-site/generated/pages.json', import.meta.url), 'utf8'));
const paths = [...new Set(['/', ...Object.keys(catalog).filter(p => !p.includes('404')), '/blog', '/aviso-de-privacidad', '/terminos-de-servicio', '/pixelbot', '/login', '/robots.txt', '/sitemap.xml', '/api/health'])];
const results = [];
for (const path of paths) {
  try {
    const r = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20000) });
    const body = await r.text();
    results.push({ path, status: r.status, ok: r.ok, bytes: body.length });
  } catch (error) { results.push({ path, ok: false, error: String(error) }); }
}
for (const [path, expected] of [['/proyectos', 307], ['/not-a-real-wo509-route', 404]]) {
  const r = await fetch(new URL(path, base), { redirect: 'manual', signal: AbortSignal.timeout(20000) });
  const location = r.headers.get('location');
  results.push({ path, status: r.status, location, ok: r.status === expected && (path !== '/proyectos' || Boolean(location?.includes('/login'))) });
}
const report = { checkedAt: new Date().toISOString(), origin: base.origin, passed: results.every(r => r.ok), results };
if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ origin: base.origin, routes: results.length, passed: report.passed, failures: results.filter(r => !r.ok) }, null, 2));
if (!report.passed) process.exitCode = 1;
