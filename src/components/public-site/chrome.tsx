'use client';
import {usePathname} from 'next/navigation';
import shell from './generated/shell.json';
import english from './generated/shell-en.json';
import {PublicTree,type PublicNode} from './tree';
function routeHeader(node:PublicNode,path:string):PublicNode{
 if(typeof node==='string')return node;
 const attrs={...node.attrs};
 if(node.tag==='a'){
  if(String(attrs.className??'').includes('language-link'))attrs.href=path.startsWith('/en')?(path.slice(3)||'/'):'/en'+(path==='/'?'':path);
  if('aria-current' in attrs)delete attrs['aria-current'];
  const href=typeof attrs.href==='string'?attrs.href.replace(/\/$/,''):'';
  if(href&&href.startsWith('/')&&(path===href||path.startsWith(href+'/')))attrs['aria-current']='page';
 }
 return {...node,attrs,children:node.children.map(child=>routeHeader(child,path))};
}
export function PublicChrome({part}:{part:'header'|'footer'|'extras'}){const path=usePathname();const data=path.startsWith('/en')?english:shell;return part==='extras'?<>{(data.extras as unknown as PublicNode[]).filter(Boolean).map((node,i)=><PublicTree key={i} node={node}/>)}</>:<PublicTree node={part==='header'?routeHeader(data[part] as unknown as PublicNode,path):data[part] as unknown as PublicNode}/>;}
