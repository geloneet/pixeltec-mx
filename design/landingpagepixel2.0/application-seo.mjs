import {build} from 'esbuild';
import {readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {z} from 'zod';

const graphNode=z.object({'@id':z.url(),'@type':z.union([z.string(),z.array(z.string())])}).passthrough();
const snapshotSchema=z.object({
 source:z.literal('pixeltec-mx application: generated public SEO export'),
 files:z.record(z.string(),z.string().regex(/^[a-f0-9]{64}$/)),
 siteGraph:z.object({'@context':z.literal('https://schema.org'),'@graph':z.array(graphNode)}),
 ORG_ID:z.literal('https://pixeltec.mx/#organization'),
 WEBSITE_ID:z.literal('https://pixeltec.mx/#website'),
 redirects:z.array(z.object({source:z.string(),destination:z.string(),permanent:z.boolean(),origin:z.literal('next.config.ts')})),
});

// Repository builds read canonical code. The standalone design handoff uses
// its generated public export, never a second hand-maintained identity.
export async function applicationSEO(){
 const snapshot='docs/application-seo.generated.json';
 const canonicalRoot=await access('../../next.config.ts').then(()=>true,()=>false);
 if(!canonicalRoot){
  console.info('Standalone design build: using the bundled public SEO export; refresh from the application repository before release.');
  return snapshotSchema.parse(JSON.parse(await readFile(snapshot,'utf8')));
 }
 const files={};
 for(const path of ['src/lib/seo/site-graph.ts','src/lib/site-config.ts','src/lib/content/services-catalog.ts','next.config.ts'])files[path]=createHash('sha256').update(await readFile('../../'+path)).digest('hex');
 await build({entryPoints:['../../src/lib/seo/site-graph.ts'],outfile:'.build/site-graph.js',bundle:true,format:'esm',platform:'node'});
 const {siteGraph,ORG_ID,WEBSITE_ID}=await import('./.build/site-graph.js');
 const config=await readFile('../../next.config.ts','utf8');
 const redirects=[...config.matchAll(/source:\s*['"]([^'"]+)['"],\s*destination:\s*['"]([^'"]+)['"],\s*permanent:\s*(true|false)/g)].map(m=>({source:m[1],destination:m[2],permanent:m[3]==='true',origin:'next.config.ts'}));
 const data=snapshotSchema.parse({source:'pixeltec-mx application: generated public SEO export',files,siteGraph,ORG_ID,WEBSITE_ID,redirects});
 await writeFile(snapshot,JSON.stringify(data,null,2)+'\n');
 return data;
}
