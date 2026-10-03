import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadSources,articleHtml} from './source-content.mjs';
import {createPreviewServer} from './serve.mjs';
import {escapeHTML} from './.build/catalog.js';
const routes=JSON.parse(await readFile('docs/routes.json','utf8'));
const sources=await loadSources();
const html=path=>readFile('dist'+path+'index.html','utf8');
const canonical=path=>'https://pixeltec.mx'+path.replace(/\/$/,'');
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
 assert.equal(routes.length,144);
 for(const route of routes){
  const page=await html(route.path);const spanish=route.locale==='en'?route.path.slice(3):route.path;
  const english='/en'+spanish;
  assert.match(page,new RegExp('<html[^>]*lang="'+(route.locale==='en'?'en':'es(?:-MX)?')+'"'));
  assert.ok(page.includes('rel="canonical" href="'+canonical(route.path)+'"'),route.path);
  for(const [lang,path] of [['es-MX',spanish],['en',english],['x-default',spanish]]){
   const actual=page.match(new RegExp('hreflang="'+lang+'" href="([^"]+)"'))?.[1];
   assert.equal(actual?.replace(/\/$/,''),canonical(path),route.path+' '+lang);
  }
  assert.ok(page.includes('class="language-link" href="'+(route.locale==='en'?spanish:english)+'"'),route.path+' switch');
  assert.match(page,/name="robots" content="noindex,nofollow"/);
 }
});
test('all 144 routes return HTTP 200; missing paths return 404',async()=>{
 const server=createPreviewServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{const origin='http://127.0.0.1:'+server.address().port;for(const route of routes)assert.equal((await fetch(origin+route.path)).status,200,route.path);assert.equal((await fetch(origin+'/missing-page/')).status,404);}finally{await new Promise(r=>server.close(r));}
});
test('source rendering escapes text and disallows unsafe link protocols',()=>{
 const out=articleHtml([{tag:'p',children:[{tag:'text',text:'<script>alert(1)</script>'}]},{tag:'a',href:'javascript:alert(1)',children:[{tag:'text',text:'unsafe'}]},{tag:'a',href:'https://pixeltec.mx/about',children:[{tag:'text',text:'About'}]}],new Set(['/about/']));
 assert.ok(!out.includes('<script>'));assert.ok(!out.includes('javascript:'));assert.ok(out.includes('href="/about/"'));
});

test('home first paint contains localized content and working links before runtime startup',async()=>{
 for(const path of ['/','/en/']){
  const page=await html(path);
  const first=page.match(/id="home-first-paint">([\s\S]*?)<x-dc>/)?.[1];
  assert.ok(first,path+' first paint missing');
  assert.doesNotMatch(first,/\{\{|\bonClick=|\bref=/);
  const title=first.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1];
  const template=page.slice(page.indexOf('<x-dc>'));
  assert.equal(title,template.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1],path+' duplicate content drift');
  const prefix=path==='/en/'?'/en':'';
  for(const target of ['/services/','/about/','/contact/','/diagnostico/'])assert.ok(first.includes('href="'+prefix+target+'"'),path+' '+target);
  assert.match(page,/src="\/app-navigation.js"/);
 }
});
