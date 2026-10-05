import {test} from 'node:test';
import {parseHTML} from 'linkedom';
import {company,serviceContent,caseStudies,featuredCaseStudies,testimonials,editorial,method} from './.build/content.js';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSources,articleHtml} from './source-content.mjs';
import {createPreviewServer} from './serve.mjs';
import {englishComplete,indexPolicy} from './.build/seo-policy.js';
import {escapeHTML} from './.build/catalog.js';
import {renderer} from './.build/templates.js';
import {robotsMeta} from './.build/seo-policy.js';
import {inspectHome,inspectRelease,assertReleaseReady} from './release-check.mjs';
import {spawnSync} from 'node:child_process';
const routes=JSON.parse(await readFile('docs/routes.json','utf8'));
const sources=await loadSources();
const html=path=>readFile('dist'+path+'index.html','utf8');
const canonical=path=>'https://pixeltec.mx'+path.replace(/\/$/,'');
test('public HTML excludes incomplete English and utility pages; preview remains excluded',async()=>{
 const inventory=JSON.parse(await readFile('docs/seo-inventory.json','utf8'));
 let incomplete=0;let eligible=0;
 for(const route of inventory.routes){
  const path=route.locale==='en'?route.path.slice(3):route.path;
  const page={path,title:route.title,family:route.family,body:'<h1>Policy fixture</h1>'};
  const output=renderer(route.locale,'public').document(page);
  const expected=route.candidateIndexable?'index,follow':'noindex,nofollow';
  assert.match(output,new RegExp('name="robots" content="'+expected+'"'),route.path);
  assert.match(renderer(route.locale).document(page),/name="robots" content="noindex,nofollow"/);
  assert.equal((output.match(/name="robots"/g)??[]).length,1);
  if(path==='/')assert.ok(output.includes(robotsMeta('/',route.locale,'public')));
  if(route.candidateIndexable)eligible++;
  if(route.contentStatus==='translation-incomplete'){incomplete++;assert.equal(expected,'noindex,nofollow');}
 }
 assert.equal(incomplete,52);assert.equal(eligible,94);
});
test('release gate rejects client-only home even with a decorative H2 and preserves preview on public build',async()=>{
 const before=await html('/');
 const report=await inspectRelease();
 assert.equal(report.homes.length,2);
 for(const home of report.homes){assert.equal(home.h1,1);assert.equal(home.h2,8);assert.equal(home.status,'PASS');assert.equal(home.clientOnlyTemplate,false);}
 assert.throws(()=>assertReleaseReady(report),/RELEASE BLOCKED.*NEXT_INTEGRATION/);
 assert.equal(inspectHome('<h1>Title</h1><h2>Decorative</h2>').status,'FAIL');
 assert.equal(inspectHome('<main><h1>Title</h1><h2>Service</h2><p>Approved service content</p></main>').status,'FAIL');
 const attempt=spawnSync(process.execPath,['build.mjs'],{encoding:'utf8',env:{...process.env,SEO_ENV:'public'}});
 assert.notEqual(attempt.status,0);assert.match(attempt.stderr,/RELEASE BLOCKED/);
 assert.equal(await html('/'),before,'blocked build must not replace preview');
});
test('all published Spanish URLs retain title, description and canonical',async()=>{
 assert.equal(sources.size,60);
 for(const [path,source] of sources){
  assert.ok(routes.some(r=>r.path===path),path);
  const page=await html(path);
  assert.ok(page.includes('<title>'+escapeHTML(source.seo.title)+'</title>'),path+' title');
  assert.ok(page.includes('name="description" content="'+escapeHTML(source.seo.description)+'"'),path+' description');
  assert.equal(page.match(/rel="canonical" href="([^"]+)"/)[1].replace(/\/$/,''),source.seo.canonical.replace(/\/$/,''),path+' canonical');
 }
});
test('every ES/EN page has reciprocal language links, self canonical and preview noindex',async()=>{
 assert.equal(routes.length,152);
 for(const route of routes){
  const page=await html(route.path);const spanish=route.locale==='en'?route.path.slice(3):route.path;
  const english='/en'+spanish;
  assert.match(page,new RegExp('<html[^>]*lang="'+(route.locale==='en'?'en':'es(?:-MX)?')+'"'));
  assert.ok(page.includes('rel="canonical" href="'+canonical(route.path)+'"'),route.path);
  for(const [lang,path] of [['es-MX',spanish],['en',english],['x-default',spanish]]){
   const actual=page.match(new RegExp('hreflang="'+lang+'" href="([^"]+)"'))?.[1];
   if(indexPolicy(spanish,'es').eligible&&englishComplete(spanish))assert.equal(actual?.replace(/\/$/,''),canonical(path),route.path+' '+lang);else assert.equal(actual,undefined,route.path+' incomplete/excluded alternate');
  }
  assert.ok(page.includes('class="language-link" href="'+(route.locale==='en'?spanish:english)+'"'),route.path+' switch');
  assert.match(page,/name="robots" content="noindex,nofollow"/);
 }
});
test('public routes return expected status; explicit and missing error routes return 404',async()=>{
 const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const origin='http://127.0.0.1:'+server.address().port;for(const route of routes)assert.equal((await fetch(origin+route.path)).status,/^\/(?:en\/)?404\/$/.test(route.path)?404:200,route.path);assert.equal((await fetch(origin+'/missing-page/')).status,404);}finally{await new Promise(r=>server.close(r));}
});
test('source rendering escapes text and disallows unsafe link protocols',()=>{
 const out=articleHtml([{tag:'p',children:[{tag:'text',text:'<script>alert(1)</script>'}]},{tag:'a',href:'javascript:alert(1)',children:[{tag:'text',text:'unsafe'}]},{tag:'a',href:'https://pixeltec.mx/about',children:[{tag:'text',text:'About'}]}],new Set(['/about/']));
 assert.ok(!out.includes('<script>'));assert.ok(!out.includes('javascript:'));assert.ok(out.includes('href="/about/"'));
});

test('complete approved ES/EN home content exists in the shipped HTML before JavaScript',async()=>{
 for(const path of ['/','/en/']){
  const page=await html(path), locale=path==='/en/'?'en':'es';
  const doc=parseHTML(page).document, root=doc.querySelector('#dc-root');
  assert.ok(root?.hasAttribute('data-home-ssr'));
  assert.ok(page.includes('href="'+(locale==='en'?'/en/mapa/':'/mapa/')+'" aria-label="'+(locale==='en'?'All pages':'Todas las páginas')+'"'));
  const text=root.textContent.replace(/\s+/g,' ').trim();
  const approved=[company.about[locale],company.team[locale],...serviceContent.flatMap(s=>[s.title[locale],s.description[locale]]),...featuredCaseStudies.map(c=>c.name),...testimonials.flatMap(c=>[c.name,c.quote[locale]]),...method.flatMap(m=>[m.title[locale],m.body[locale]]),...editorial.slice(0,4).map(e=>e.title[locale])];
  for(const copy of approved)assert.ok(text.includes(copy.replace(/\s+/g,' ').trim()),path+' missing approved copy: '+copy);
  assert.equal(root.querySelectorAll('h1').length,1);
  assert.equal(root.querySelectorAll('h2').length,8);
  assert.doesNotMatch(root.innerHTML,/\{\{|\bonClick=|\bref=|<sc-for/);
  const prefix=locale==='en'?'/en':'';
  for(const target of ['/services/','/about/','/contact/','/diagnostico/'])assert.ok(root.querySelector('a[href="'+prefix+target+'"]'));
  const menu=root.querySelector('#home-menu');assert.equal(menu.getAttribute('aria-hidden'),'true');assert.match(menu.getAttribute('style'),/visibility:hidden/);
  assert.equal(root.querySelector('[aria-controls="home-menu"]').getAttribute('aria-expanded'),'false');
  assert.equal(inspectHome(page).status,'PASS');
  const services=doc.querySelector('#servicios'); services.remove();
  assert.equal(inspectHome(doc.toString()).status,'FAIL','missing service section must block release');
 }
});

test('one source H1, one consistent entity graph and social metadata per route',async()=>{
 for(const route of routes){
  const page=await html(route.path);
  assert.equal((page.match(/<h1\b/g)??[]).length,1,route.path+' heading');
  const graphs=[...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(graphs.length,1,route.path+' graph');
  const graph=JSON.parse(graphs[0][1])['@graph'];
  assert.equal(graph.filter(n=>n['@id']==='https://pixeltec.mx/#organization').length,1);
  assert.equal(new Set(graph.map(n=>n['@id'])).size,graph.length);
  assert.ok(!graph.some(n=>n['@type']==='FAQPage'||n.aggregateRating),route.path+' unsupported claims');
  assert.match(page,/property="og:title"/);assert.match(page,/name="twitter:card"/);
 }
});
test('approved legal and guide lists/tables survive; every retained source link stays safe',async()=>{
 const data=JSON.parse(await readFile('docs/public-rich-source-2026-10-03.json','utf8'));
 const inventory=JSON.parse(await readFile('docs/seo-inventory.json','utf8'));
 for(const source of data){
  const path=new URL(source.url).pathname.replace(/\/$/,'')+'/';
  const family=inventory.routes.find(r=>r.locale==='es'&&r.path===path)?.family;
  if(!['/aviso-de-privacidad/','/terminos-de-servicio/','/data-deletion/'].includes(path)&&!['Presencia local','Guías para decidir'].includes(family))continue;
  const page=await html(path);
  for(const tag of ['li','table'])assert.ok((page.match(new RegExp('<'+tag+'\\b','g'))??[]).length>=source.retainedCounts[tag],path+' lost '+tag);
  assert.match(page,/class="article-copy source-copy"/);
 }
 for(const row of inventory.routes.filter(r=>r.locale==='en'&&r.contentStatus==='translation-incomplete')){
  assert.equal(row.candidateIndexable,false,row.path);assert.equal(row.hasCandidateAlternates,false,row.path);
 }
 const candidate=await readFile('docs/sitemap-candidate.xml','utf8');
 assert.ok(!candidate.includes('/login'));assert.ok(!candidate.includes('/en/blog/'));assert.ok(!candidate.includes('/metodologia'));
 const legacy=inventory.searchOnly.find(r=>r.url.includes('escalabilidad-en-la-nube'));
 assert.equal(legacy?.configuredRedirect?.destination,'/blog');
});

test('legal contact slots absent in server snapshots retain their approved address',async()=>{
 for(const path of ['/aviso-de-privacidad/','/data-deletion/']){
  const page=await html(path);const article=page.match(/<article class="article-copy source-copy">([\s\S]*?)<\/article>/)[1];
  assert.ok(article.includes('href="mailto:contacto@pixeltec.mx"'),path);
  assert.ok(!article.includes('correo electrónico a .'),path);
 }
});

test('shared footer appears once across all routes and home diagnostic starts inline',async()=>{
 for(const route of routes){
  const page=await readFile('dist'+route.path+'index.html','utf8');
  const {document}=parseHTML(page);
  assert.equal(document.querySelectorAll('footer.pixel-footer').length,1,route.path);
  assert.equal(document.querySelectorAll('.pixel-footer-grid').length,1,route.path);
 }
 for(const prefix of ['','/en']){
  const {document}=parseHTML(await readFile('dist'+prefix+'/index.html','utf8'));
  assert.equal(document.querySelector('[data-start-diagnostic]')?.tagName,'BUTTON');
  assert.ok(document.querySelector('[data-inline-diagnostic]').hasAttribute('hidden'));
  assert.equal(document.querySelectorAll('#diagnostic-form [data-step]').length,4);
  assert.equal(document.querySelectorAll('#diagnostic-form [data-step]:not([hidden])').length,1);
  assert.ok(document.querySelector('[data-summary]').hasAttribute('hidden'));
 }
});
