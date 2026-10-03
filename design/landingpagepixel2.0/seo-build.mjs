import {applicationSEO} from './application-seo.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {canonicalURL,indexPolicy,languageAlternates,englishComplete} from './.build/seo-policy.js';
import {localPath} from './.build/i18n.js';
import {editorial,serviceContent,industryContent} from './.build/content.js';
import {escapeHTML} from './.build/catalog.js';
const {siteGraph,ORG_ID,WEBSITE_ID,redirects}=await applicationSEO();
export const siteContactEmail=siteGraph['@graph'].find(node=>node['@id']===ORG_ID).email;
const json=data=>JSON.stringify(data).replaceAll('<','\\u003c');
export function addStructuredData(html,page){
 const url=canonicalURL(localPath(page.path,page.locale));
 const name=html.match(/<title>([\s\S]*?)<\/title>/)?.[1].replace(/&amp;/g,'&')??page.title;
 const webpage={'@type':'WebPage','@id':url+'#webpage',url,name,inLanguage:page.locale==='es'?'es-MX':'en',isPartOf:{'@id':WEBSITE_ID},about:{'@id':ORG_ID}};
 const graph=[...siteGraph['@graph'],webpage];
 if(page.path!=='/'&&indexPolicy(page.path,page.locale).eligible){
  const itemListElement=[{'@type':'ListItem',position:1,name:page.locale==='es'?'Inicio':'Home',item:canonicalURL(localPath('/',page.locale))},{'@type':'ListItem',position:2,name:page.title,item:url}];
  graph.push({'@type':'BreadcrumbList','@id':url+'#breadcrumb',itemListElement});
  webpage.breadcrumb={'@id':url+'#breadcrumb'};
 }
 const service=[...serviceContent,...industryContent].find(s=>s.path===page.path);
 if(service)graph.push({'@type':'Service','@id':url+'#service',name:service.title[page.locale],description:service.description[page.locale],url,provider:{'@id':ORG_ID},mainEntityOfPage:{'@id':webpage['@id']}});
 const post=editorial.find(p=>p.path===page.path);
 if(post&&page.locale==='es')graph.push({'@type':'BlogPosting','@id':url+'#article',headline:post.title.es,datePublished:post.date,author:{'@type':post.author==='Administrador'?'Organization':'Person',name:post.author},publisher:{'@id':ORG_ID},mainEntityOfPage:{'@id':webpage['@id']},inLanguage:'es-MX'});
 return html.replace('</head>','<script type="application/ld+json">'+json({'@context':'https://schema.org','@graph':graph})+'</script></head>');
}
export async function writeInventory(entries,sources,richSources){
 const rows=entries.map(p=>{
  const path=p.locale==='en'?p.path.slice(3):p.path;const source=sources.get(path);const rich=richSources.get(path);const policy=indexPolicy(path,p.locale);
  return {...p,canonical:canonicalURL(p.path),expectedPreviewStatus:path==='/404/'?404:200,previewRobots:'noindex,nofollow',candidateIndexable:policy.eligible,indexReason:policy.reason,hasCandidateAlternates:languageAlternates(path)!=='',contentStatus:p.locale==='en'&&!englishComplete(path)?'translation-incomplete':source?'published-source-adapted':'curated-content',source:source?.url??null,sourceSha256:rich?.sha256??null,productionReady:false};
 });
 const gsc=JSON.parse(await readFile('docs/gsc-baseline-2026-10-03.json','utf8'));
 const seen=new Set(rows.map(p=>p.canonical));
 const searchOnly=gsc.reports[0].pages.filter(p=>!seen.has(p['Páginas principales'].replace(/\/$/,''))).map(p=>({url:p['Páginas principales'],clicks:Number(p.Clics),impressions:Number(p.Impresiones),configuredRedirect:redirects.find(r=>r.source===new URL(p['Páginas principales']).pathname)??null}));
 const result={date:'2026-10-03',scope:'Prototype + observed public sources + existing configured redirects. Not a complete Google index inventory.',searchConsole:'Authenticated CSV export 2026-10-03, canonical host, 3 months and 28 days; see gsc-baseline-2026-10-03.json',searchOnly,excludedHosts:[{host:'encino.pixeltec.mx',reason:'Miguel confirmed 2026-10-03: retired project migrated to another domain; outside landing redesign scope'}],currentSitemapFetch:'Direct request 403; GSC reports Correcto, 60 URLs, last read 2026-09-30. Do not infer Googlebot is blocked.',productionGate:'blocked: Next.js integration, content/translation parity, live business flows and final release validation',routes:rows,existingRedirects:redirects};
 await writeFile('docs/seo-inventory.json',JSON.stringify(result,null,2)+'\n');
 // Review artifact only: never replace the application’s CMS-driven sitemap with this snapshot.
 const urls=rows.filter(p=>p.candidateIndexable).map(p=>'<url><loc>'+escapeHTML(p.canonical)+'</loc></url>').join('\n');
 await writeFile('docs/sitemap-candidate.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls+'\n</urlset>\n');
}
