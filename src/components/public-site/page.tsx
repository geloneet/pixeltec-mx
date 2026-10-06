import {notFound} from 'next/navigation';
import pages from './generated/pages.json';
import {PublicTree,type PublicNode} from './tree';
type Page={title:string;description:string;body:PublicNode;noindex:boolean;schemas:Record<string,unknown>[]};
const catalog=pages as unknown as Record<string,Page>;
export function publicPage(path:string){return catalog[path.replace(/\/$/,'')];}
export function PublicPage({path}:{path:string}){const page=publicPage(path);if(!page)notFound();return <>{page.schemas?.map((schema,i)=>{const graph=schema['@graph'];const filtered=Array.isArray(graph)?{...schema,'@graph':graph.filter(n=>!String(n['@id']??'').match(/#(organization|website)$/))}:schema;return <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(filtered).replace(/</g,'\\u003c')}}/>;})}<PublicTree node={page.body}/></>;}
