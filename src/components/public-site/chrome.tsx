'use client';
import {usePathname} from 'next/navigation';
import shell from './generated/shell.json';
import english from './generated/shell-en.json';
import {PublicTree,type PublicNode} from './tree';
export function PublicChrome({part}:{part:'header'|'footer'|'extras'}){const path=usePathname();const data=path.startsWith('/en')?english:shell;return part==='extras'?<>{(data.extras as unknown as PublicNode[]).filter(Boolean).map((node,i)=><PublicTree key={i} node={node}/>)}</>:<PublicTree node={data[part] as unknown as PublicNode}/>;}
