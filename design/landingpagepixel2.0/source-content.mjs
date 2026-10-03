import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import {escapeHTML as esc} from './.build/catalog.js';
const NodeSchema=z.lazy(()=>z.object({tag:z.enum(['text','span','h2','h3','h4','p','ul','ol','li','strong','em','a','blockquote','table','thead','tbody','tr','th','td','pre','code','br','div']),text:z.string().optional(),id:z.string().optional(),href:z.string().nullable().optional(),children:z.array(NodeSchema).optional()}));
const SourceSchema=z.object({url:z.url().refine(u=>new URL(u).origin==='https://pixeltec.mx'),text:z.string(),seo:z.object({title:z.string().min(1),description:z.string(),canonical:z.url(),h1:z.string()}),blocks:z.array(z.object({tag:z.enum(['H1','H2','H3','P']),text:z.string()})).optional(),article:z.array(NodeSchema).optional()});
export async function loadSources(){const data=z.array(SourceSchema).parse(JSON.parse(await readFile('docs/published-content-2026-10-03.json','utf8')));return new Map(data.map(s=>[new URL(s.url).pathname.replace(/\/$/,'')+'/',s]));}
export async function loadRichSources(){
 const schema=z.array(z.object({url:z.url().refine(u=>new URL(u).origin==='https://pixeltec.mx'),status:z.literal(200),nodes:z.array(NodeSchema),interactiveElements:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}));
 const data=schema.parse(JSON.parse(await readFile('docs/public-rich-source-2026-10-03.json','utf8')));
 return new Map(data.map(s=>[new URL(s.url).pathname.replace(/\/$/,'')+'/',s]));
}
export function articleHtml(nodes,knownPaths){
 const render=n=>{if(n.tag==='text')return esc(n.text??'');const body=(n.children??[]).map(render).join('');if(n.tag==='br')return '<br>';if(n.tag==='a'){
  let href=n.href??'';
  try{const u=new URL(href,'https://pixeltec.mx');if(!['http:','https:','mailto:','tel:'].includes(u.protocol))return body;const path=u.pathname.replace(/\/$/,'')+'/';if(u.origin==='https://pixeltec.mx'&&knownPaths.has(path))href=path+u.search+u.hash;else href=u.href;}catch{return body;}
  return `<a href="${esc(href)}">${body}</a>`;
 }return `<${n.tag}${n.id?' id="'+esc(n.id)+'"':''}>${body}</${n.tag}>`;};
 return nodes.map(render).join('');
}

// These contact slots are client-rendered by ObfuscatedMailto in the existing
// application's legal pages. Restore the verified site-config address, not an
// inferred email from a scraper or a new legal claim.
export function legalHtml(nodes,knownPaths,email){
 const restore=n=>{
  if(n.tag==='text'&&/(correo electrónico a[: ]$|escribe a$)/.test(n.text??''))return {...n,tag:'span',text:undefined,children:[{tag:'text',text:n.text+' '},{tag:'a',href:'mailto:'+email,children:[{tag:'text',text:email}]}]};
  return {...n,...(n.children?{children:n.children.map(restore)}:{})};
 };
 return articleHtml(nodes.map(restore),knownPaths);
}
