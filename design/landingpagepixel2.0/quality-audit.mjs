import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
const routes=JSON.parse(await readFile('docs/routes.json','utf8'));
const issues=[],editorialPending=[];let images=0;
for(const {path} of routes){
 const doc=parseHTML(await readFile('dist'+path+'index.html','utf8')).document;
 doc.querySelectorAll('script,style,template').forEach(n=>n.remove());
 const ids=new Set();
 for(const e of doc.querySelectorAll('[id]')){if(ids.has(e.id))issues.push({path,type:'duplicate-id',value:e.id});ids.add(e.id);}
 for(const image of doc.querySelectorAll('img')){images++;if(!image.hasAttribute('alt')||!image.hasAttribute('width')||!image.hasAttribute('height'))issues.push({path,type:'image-metadata',value:image.getAttribute('src')});}
 const text=doc.body.textContent.replace(/\s+/g,' ');
 if(/lorem ipsum|\[\s*(?:foto|captura)|\{\{|this prototype|este prototipo/i.test(text))issues.push({path,type:'unfinished-copy'});
 if(/English overview|brief overview|full Spanish document/.test(text))editorialPending.push(path);
}
const media=['pixeltec-editorial-640.webp','pixeltec-editorial-1280.webp','pixeltec-method-640.webp','pixeltec-method-1080.webp'];
const mediaBytes={};for(const asset of media){mediaBytes[asset]=(await stat('dist/assets/'+asset)).size;assert.ok(mediaBytes[asset]<200000,'Illustration exceeds 200KB: '+asset);}
const report={date:'2026-10-05',scope:'Static built HTML audit; not Lighthouse, field Web Vitals or a production release certification',routes:routes.length,images,issues,editorialPending,mediaBytes};
await writeFile('docs/quality-audit.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({routes:routes.length,images,issues,pendingEnglish:editorialPending.length,mediaBytes},null,2));
assert.equal(issues.length,0,'Built-page quality audit failed');
