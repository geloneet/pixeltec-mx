import { optimizeAssets, optimizeHome, compressOutput } from './optimize.mjs';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import {renderer,logo,canonicalPath} from './.build/templates.js';
import {homeContent} from './.build/home-content.js';
import {serviceContent,caseStudies,industryContent,editorial} from './.build/content.js';
import {guideContent} from './.build/guides.js';
import {languages,localPath} from './.build/i18n.js';
import {escapeHTML,services,projects,posts} from './.build/catalog.js';
import {loadSources,articleHtml} from './source-content.mjs';
const sources=await loadSources();
const xml=await readFile('docs/sitemap-observed.xml','utf8');
const livePaths=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname.replace(/\/$/,'')+'/');
const allPages=[];const entries=[];
for(const locale of languages){
 const t=renderer(locale);const x=(es,en)=>locale==='es'?es:en;const pages=[];
 const add=(path,title,family,body,description)=>pages.push({path,title,family,body,description});
 add('/services/',x('Servicios','Services'),x('Servicios','Services'),t.serviceIndex());
 for(const s of serviceContent)add(s.path,s.title[locale],x('Servicios','Services'),t.serviceDetail(s),s.description[locale]);
 add('/about/',x('Nosotros','About'),x('Empresa','Company'),t.about());
 add('/equipo/',x('Equipo','Team'),x('Empresa','Company'),t.team());
 add('/metodologia/',x('Metodología','Our process'),x('Empresa','Company'),t.methodology());
 add('/proyectos/',x('Proyectos','Work'),x('Proyectos','Work'),t.projectIndex());
 for(const p of caseStudies)add(p.path,p.name,x('Proyectos','Work'),t.projectDetail(p),p.description[locale]);
 add('/industrias/',x('Industrias','Industries'),x('Industrias','Industries'),t.industryIndex());
 for(const i of industryContent.slice(0,2))add(i.path,i.title[locale],x('Industrias','Industries'),t.serviceDetail(i,x('INDUSTRIAS','INDUSTRIES')),i.description[locale]);
 add('/blog/',x('Blog','Journal'),x('Editorial','Journal'),t.blogIndex());
 for(const p of editorial){
  let body=t.article(p);
  const source=sources.get(p.path);
  if(locale==='es'&&source?.article){
   const start=body.indexOf('<article class="article-copy">');const end=body.indexOf('</article>',start);
   body=body.slice(0,start)+'<article class="article-copy"><p class="source-note">'+p.author+' · '+p.date+'</p>'+articleHtml(source.article,new Set(livePaths))+'<p class="source-note">Contenido publicado en PixelTEC. Las herramientas interactivas del artículo pueden consultarse en la publicación original.</p><a class="text-link" href="'+source.url+'">Ver publicación original ↗</a>'+body.slice(end);
   // The imported article has its own headings; remove the overview-only fragment links.
   body=body.replace(/<a href="#idea-[0-9]+">.*?<\/a>/g,'');
  }
  add(p.path,p.title[locale],x('Editorial','Journal'),body,p.description[locale]);
 }
 add('/contact/',x('Contacto','Contact'),x('Contacto y acceso','Contact & access'),t.contact());
 add('/diagnostico/',x('Diagnóstico','Assessment'),x('Contacto y acceso','Contact & access'),t.diagnostic());
 add('/login/',x('Acceso de clientes','Client access'),x('Contacto y acceso','Contact & access'),t.auth());
 add('/reset-password/',x('Recuperar acceso','Recover access'),x('Contacto y acceso','Contact & access'),t.auth(true));
 for(const [path,es,en] of [['aviso-de-privacidad','Aviso de privacidad','Privacy notice'],['terminos-de-servicio','Términos de servicio','Terms of service'],['data-deletion','Eliminación de datos','Data deletion']])add('/'+path+'/',x(es,en),x('Información','Information'),t.legal(x(es,en),'/'+path+'/'));
 const local=[];
 for(const path of livePaths){
  if(path==='/'||pages.some(p=>p.path===path))continue;
  const source=sources.get(path);if(!source)throw new Error('Missing approved source '+path);
  const intro=source.blocks?.find(b=>b.tag==='P'&&b.text.length>100)?.text;
  const title=source.blocks?.find(b=>b.tag==='H1')?.text;
  if(!intro||!title)throw new Error('Missing approved guide text '+path);
  const item=guideContent(path,title,intro);
  const blocks=(source.blocks??[]).filter(b=>b.tag!=='H1'&&b.text!==intro&&b.text.trim());
  add(path,item.title[locale],item.category[locale],t.guide(item,blocks),item.description[locale]);local.push(pages.at(-1));
 }
 add('/guias-transformacion/',x('Guías y presencia local','Guides & local presence'),x('Empresa','Company'),t.directory(local));
 add('/404/',x('Página no encontrada','Page not found'),x('Sistema','System'),t.notFound());
 const mapEntries=[{path:'/',title:x('Inicio','Home'),family:x('Inicio','Home')},...pages.map(({path,title,family})=>({path,title,family}))];
 add('/mapa/',x('Mapa del sitio','Sitemap'),x('Sistema','System'),t.directory(mapEntries,true));
 for(const page of pages){
  const seo=sources.get(page.path)?.seo;
  if(locale==='es'&&seo){page.title=seo.title.replace(/ \| PixelTEC$/,'');page.description=seo.description;}
  allPages.push({...page,locale,html:t.document(page)});
 }
 entries.push(...[{path:'/',title:x('Inicio','Home'),family:x('Inicio','Home')},...pages].map(({path,title,family})=>({path:localPath(path,locale),title,family,locale})));
}
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
await cp('.build/client.js','dist/client.js');await cp('.build/motion.js','dist/motion.js');
await optimizeAssets();
await writeFile('dist/favicon.svg',logo.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" '));
for(const page of allPages){const dir='dist'+localPath(page.path,page.locale);await mkdir(dir,{recursive:true});await writeFile(dir+'index.html',page.html);}
await writeFile('dist/404.html',allPages.find(p=>p.path==='/404/'&&p.locale==='es').html);
await writeFile('dist/robots.txt','User-agent: *\nDisallow: /\n');
await writeFile('dist/routes.json',JSON.stringify(entries,null,2));
let home=await readFile('src/home.dc.html','utf8');
home=home.replace('<html>','<html lang="es">').replace('<head>','<head>\n<title>PixelTEC · Inicio</title>\n<meta name="robots" content="noindex,nofollow"><link rel="icon" href="/favicon.svg">');
home=home.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g,a=>{
 const text=a.replace(/<[^>]*>/g,'').trim();
 let href=null;
 if(/Industrias/.test(text))href='/industrias/';
 else if(/^Iniciar diagnóstico|^Comenzar/.test(text))href='/diagnostico/';
 else if(/Ver todos los servicios/.test(text))href='/services/';
 else if(/Más sobre nosotros/.test(text))href='/about/';
 else if(text.includes('VER TODOS'))href='/proyectos/';
 else if(/p\.name/.test(text))href='{{ p.href }}';
 else if(/b\.title/.test(text))href='{{ b.href }}';
 else if(/^Servicios\.?$/.test(text))href='/services/';
 else if(/^Proyectos\.?$/.test(text))href='/proyectos/';
 else if(/^Nosotros\.?$/.test(text))href='/about/';
 else if(/^Blog\.?$/.test(text))href='/blog/';
 else if(/^Contacto\.?$|^Hablemos$|^Hablar con/.test(text))href='/contact/';
 else if(text==='Aviso de Privacidad')href='/aviso-de-privacidad/';
 else if(text==='Automatización con IA')href='/services/automatizacion/';
 else if(text==='Desarrollo Web &amp; Apps')href='/services/ecosistemas-web/';
 else if(text==='WhatsApp IA')href='/pixelbot/';
 else if(text==='Consultoría TI'||text==='Soporte TI')href='/services/consultoria/';
 else if(text==='PixelTEC')href='/';
 else if(/FB\.?$|Facebook/.test(text)||a.includes('aria-label="Facebook"'))href='https://www.facebook.com/profile.php?id=61556300117500';
 else if(/IG\.?$|Instagram/.test(text)||a.includes('aria-label="Instagram"'))href='https://instagram.com/pixeltecmx';
 else if(a.includes('href="#"'))href='/contact/';
 return href?a.replace(/href="[^"]*"/,'href="'+href+'"'):a;
});
for(const p of projects)home=home.replaceAll("{ name: '"+p.title+"',","{ href: '"+p.href+"', name: '"+p.title+"',");
let postIndex=0;home=home.replace(/\{ cat: '/g,()=>"{ href: '"+posts[postIndex++ % posts.length].href+"', cat: '");
home=home.replace('{{ sv.t }}</h3>','<a href="{{ sv.href }}" style="color:inherit">{{ sv.t }}</a></h3>');
let serviceIndex=0;home=home.replace(/\{ n: '0[1-4]', t:/g,m=>"{ href: '"+services[serviceIndex++].href+"',"+m.slice(1));
home=home.replace("subLabel: this.state.subbed ? '¡Listo!' : 'Suscribirme'","subLabel: this.state.subbed ? 'Vista previa · sin envío' : 'Suscribirme'");
// Add opt-in motion hooks to the generated copy; preserve the supplied source byte-for-byte.
home=home.replace('</head>','<link rel="stylesheet" href="/motion.css"><script type="module" src="/motion.js"></script></head>').replace('<body>','<body data-pixel-home>');
home=home.replaceAll('<h2 style=', '<h2 data-motion style=');
home=home.replaceAll('<div style="display:grid;grid-template-columns:{{ svcCols }}', '<div data-motion style="display:grid;grid-template-columns:{{ svcCols }}');
home=home.replaceAll('<a href="{{ p.href }}"', '<a data-motion href="{{ p.href }}"');
// Keep the supplied home layout, styles and interactive visuals intact.
home=home.replace('</footer>','<div style="padding:24px clamp(20px,4vw,56px);border-top:1px solid #222;display:flex;flex-wrap:wrap;gap:20px;font-size:13px"><a href="/mapa/">Explorar todas las páginas ↗</a><a href="/equipo/">Equipo</a><a href="/metodologia/">Metodología</a><a href="/guias-transformacion/">Guías y presencia local</a><a href="/login/">Acceso de clientes</a><a href="/terminos-de-servicio/">Términos</a></div></footer>');

for(const locale of languages){const dir=locale==='es'?'dist/':'dist/en/';await mkdir(dir,{recursive:true});let output=homeContent(home,locale);if(locale==='es'){const seo=sources.get('/').seo;output=output.replace(/<title>[^<]+<\/title>/,'<title>'+escapeHTML(seo.title)+'</title>').replace(/<meta name="description" content="[^"]*">/,'<meta name="description" content="'+escapeHTML(seo.description)+'">');}await writeFile(dir+'index.html',await optimizeHome(output));}
await compressOutput();
await writeFile('docs/routes.json',JSON.stringify(entries,null,2));
const migration=livePaths.map(path=>({existing:sources.get(path)?.seo.canonical??'https://pixeltec.mx'+canonicalPath(path),spanish:path,english:localPath(path,'en'),action:'preserve-slug',redirectRequired:false}));
await writeFile('docs/seo-route-map.json',JSON.stringify({date:'2026-10-03',preview:'noindex,nofollow; robots Disallow /',production:'Not deployed. Keep existing Spanish URLs; canonicalize slash aliases with one permanent redirect in the production router only.',routes:migration},null,2));
console.log(`Generated ${entries.length} routes across es/en. Preserved ${livePaths.length} published Spanish slugs.`);
