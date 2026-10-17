import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {readEditorialView} from '@/lib/blog/editorial/host';
import MarkdownRenderer from '@/components/blog/markdown-renderer';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Vista previa privada — PixelTEC',robots:{index:false,follow:false}};
export default async function Preview({params}:{params:Promise<{id:string}>}) {
 const {id}=await params;
 const view=await readEditorialView(id).catch(()=>null);if(!view)notFound();
 return <main className="mx-auto max-w-3xl p-8"><p className="mb-6 text-sm">Vista previa privada · revisión {view.version} · {view.reviewed?'Revisada':'Pendiente de revisión'}</p><h1 className="mb-4 text-3xl">{view.post.title}</h1><p className="mb-8">{view.post.excerpt}</p><MarkdownRenderer content={view.post.body}/></main>;
}
