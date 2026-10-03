import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {escapeHTML as esc} from './.build/catalog.js';
const NodeSchema=z.lazy(()=>z.object({tag:z.enum(['text','span','h2','h3','h4','p','ul','ol','li','strong','em','a','blockquote','table','thead','tbody','tr','th','td','pre','code','br']),text:z.string().optional(),id:z.string().optional(),href:z.string().nullable().optional(),children:z.array(NodeSchema).optional()}));
const SourceSchema=z.object({url:z.url().refine(u=>new URL(u).origin==='https://pixeltec.mx'),text:z.string(),seo:z.object({title:z.string().min(1),description:z.string(),canonical:z.url(),h1:z.string()}),blocks:z.array(z.object({tag:z.enum(['H1','H2','H3','P']),text:z.string()})).optional(),article:z.array(NodeSchema).optional()});
export async function loadSources(){const data=z.array(SourceSchema).parse(JSON.parse(await readFile('docs/published-content-2026-10-03.json','utf8')));return new Map(data.map(s=>[new URL(s.url).pathname.replace(/\/$/,'')+'/',s]));}
export function articleHtml(nodes,knownPaths){
 const render=n=>{if(n.tag==='text')return esc(n.text??'');const body=(n.children??[]).map(render).join('');if(n.tag==='br')return '<br>';if(n.tag==='a'){
  let href=n.href??'';
  try{const u=new URL(href,'https://pixeltec.mx');if(!['http:','https:','mailto:','tel:'].includes(u.protocol))return body;const path=u.pathname.replace(/\/$/,'')+'/';if(u.origin==='https://pixeltec.mx'&&knownPaths.has(path)&&!u.hash)href=path;else href=u.href;}catch{return body;}
  return `<a href="${esc(href)}">${body}</a>`;
 }return `<${n.tag}${n.id?' id="'+esc(n.id)+'"':''}>${body}</${n.tag}>`;};
 return nodes.map(render).join('');
}
