import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
const root=resolve('dist');
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});const all=await Promise.all(entries.map(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]));return all.flat();}
const files=(await walk(root)).filter(f=>f.endsWith('.html'));
const documents=new Map(await Promise.all(files.map(async f=>[f,await readFile(f,'utf8')])));
const errors=[];let refs=0;
for(const [file,raw] of documents){
 const encoded=raw.match(/<script type="application\/json" data-dc-template>([\s\S]*?)<\/script>/)?.[1];
 const html=raw+(encoded?JSON.parse(encoded).html:"");
 for(const [,value] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  if(value.includes('{{')||/^(https?:|mailto:|tel:|data:)/.test(value))continue;
  const [path,fragment]=value.split('#');
  let target=path?(path.startsWith('/')?join(root,path):resolve(dirname(file),path)):file;
  try{if((await stat(target)).isDirectory())target=join(target,'index.html');await stat(target);}catch{errors.push(`${file}: missing ${value}`);continue;}
  refs++;
  if(fragment&&documents.has(target)&&!documents.get(target).includes(`id="${fragment}"`))errors.push(`${file}: missing anchor ${value}`);
 }
 if(!html.includes('noindex,nofollow'))errors.push(`${file}: missing prototype noindex`);
}
const live=[...(await readFile('docs/sitemap-observed.xml','utf8')).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname.replace(/\/$/,'')+'/');
for(const path of live)if(!documents.has(join(root,path,'index.html')))errors.push(`Sitemap route missing: ${path}`);
console.log(JSON.stringify({htmlFiles:files.length,localReferences:refs,sitemapRoutes:live.length,errors},null,2));
if(errors.length)process.exitCode=1;
