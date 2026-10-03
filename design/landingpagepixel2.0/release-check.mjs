import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';

// This is a prototype gate, not a Google ranking rule or a deployment approval.
export function inspectHome(html){
 const initial=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,'');
 const h1=(initial.match(/<h1\b/gi)??[]).length;
 const h2=(initial.match(/<h2\b/gi)??[]).length;
 const clientOnlyTemplate=/data-dc-template\b/.test(html);
 return {sha256:createHash('sha256').update(html).digest('hex'),h1,h2,clientOnlyTemplate,
  status:h1===1&&h2>0&&!clientOnlyTemplate?'PASS':'FAIL',
  requirement:'Serve the complete approved home content initially. Adding decorative headings does not resolve the client-only template.'};
}
export async function inspectRelease(root=new URL('./',import.meta.url)){
 const homes=[];
 for(const path of ['index.html','en/index.html']){
  try{homes.push({path,...inspectHome(await readFile(new URL('dist/'+path,root),'utf8'))});}
  catch(error){if(error.code!=='ENOENT')throw error;homes.push({path,status:'FAIL',reason:'Build missing; run npm run build first'});}
 }
 const blockers=homes.filter(h=>h.status==='FAIL').map(h=>'HOME_INITIAL_CONTENT: '+h.path);
 // No switch/env flag can approve missing integration, business parity or a release.
 blockers.push('NEXT_INTEGRATION: CMS, business flows, content parity and final candidate approval remain unverified');
 return {schemaVersion:1,productionReady:false,status:'BLOCKED',homes,blockers,
  scope:'Technical preflight only. No deployment, GSC change or publication permission.'};
}
export function assertReleaseReady(report){
 if(report.status!=='PASS'||report.productionReady!==true||report.blockers.length)throw new Error('RELEASE BLOCKED: '+report.blockers.join('; '));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const report=await inspectRelease();
 await writeFile(new URL('docs/release-readiness.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
 if(!process.argv.includes('--report-only')){try{assertReleaseReady(report);}catch(error){console.error(error.message);process.exitCode=1;}}
}
