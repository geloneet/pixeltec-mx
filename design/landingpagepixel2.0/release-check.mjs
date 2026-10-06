import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {parseHTML} from 'linkedom';

// This is a prototype gate, not a Google ranking rule or a deployment approval.
export function inspectHome(html){
 const initial=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi,'');
 const h1=(initial.match(/<h1\b/gi)??[]).length;
 const h2=(initial.match(/<h2\b/gi)??[]).length;
 const doc=parseHTML(initial).document;
 const minimums={'#nosotros h3':3,'#servicios h3':3,'#por-que h3':4,'#proyectos a[href]':6,'#blog a[href]':5,'#contacto a[href]':1,'footer a[href]':10};
 const missingContent=Object.entries(minimums).filter(([selector,n])=>doc.querySelectorAll(selector).length<n).map(([selector])=>selector);
 const contentComplete=h1===1&&h2>=7&&missingContent.length===0&&!/\{\{|<sc-for\b|sc-placeholder/.test(initial);
 const hasEnhancementTemplate=/data-dc-template\b/.test(html);
 const clientOnlyTemplate=hasEnhancementTemplate&&!contentComplete;
 return {sha256:createHash('sha256').update(html).digest('hex'),h1,h2,hasEnhancementTemplate,clientOnlyTemplate,missingContent,
  status:contentComplete?'PASS':'FAIL',
  requirement:'All home sections and their content must exist before JavaScript. Shape checks are backed by approved-content parity tests; headings alone are insufficient.'};
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
