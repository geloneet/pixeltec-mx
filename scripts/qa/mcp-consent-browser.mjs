// Isolated Chrome profile + loopback transport. Uses the actual issuer's
// synthetic POST HTML saved by mcp-consent-return.test.mjs, without changing CSP.
// Callback origin is mapped to localhost solely for this no-production test.
import http from 'node:http';import {spawn} from 'node:child_process';import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';
const original=readFileSync(process.env.MCP_SYNTHETIC_HTML_OUTPUT||'/tmp/wo626-synthetic-return.html','utf8');
assert.ok(original.includes('Volver a ChatGPT'));const legacy=process.argv.includes('--legacy');
const policy="default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";
const counts={approved:0,callback:0};let port;const server=http.createServer((req,res)=>{
 res.setHeader('Content-Security-Policy',policy);res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Type','text/html');
 const callback='http://localhost:'+port+'/callback';
 if(req.url.startsWith('/callback')){counts.callback++;res.end('<h1>synthetic callback reached</h1>');return;}
 if(req.method==='POST'){counts.approved++;if(legacy){res.writeHead(302,{Location:callback+'?code=synthetic&state=synthetic'});res.end();}else res.end(original.replaceAll('https://chatgpt.com/connector/oauth/synthetic-only',callback));return;}
 res.end('<form method="post" action="/consent"><button>Autorizar sintético</button></form>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
const profile=mkdtempSync(path.join(tmpdir(),'wo626-chrome-isolated-'));let child,ws;const sleep=n=>new Promise(r=>setTimeout(r,n));
try{
 child=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--user-data-dir='+profile,'--remote-debugging-port=0','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','about:blank'],{stdio:'ignore'});
 const active=path.join(profile,'DevToolsActivePort');for(let i=0;i<80&&!existsSync(active);i++)await sleep(100);assert.ok(existsSync(active),'Chrome debugging endpoint ready');
 const debugPort=readFileSync(active,'utf8').split('\n')[0];const tabs=await(await fetch('http://127.0.0.1:'+debugPort+'/json')).json();const tab=tabs.find(t=>t.type==='page');assert.ok(tab);
 ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;const pending=new Map();let cspViolations=0;ws.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const job=pending.get(m.id);pending.delete(m.id);m.error?job?.reject(Error(m.error.message)):job?.resolve(m.result);}if(m.method==='Log.entryAdded'&&/form-action|Content Security Policy/i.test(m.params?.entry?.text||''))cspViolations++;});
 const call=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
 await call('Page.enable');await call('Log.enable');await call('Page.navigate',{url:'http://127.0.0.1:'+port+'/'});
 async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true});return r.result?.value;}
 for(let i=0;i<50;i++){if(await evaluate('!!document.querySelector("button")'))break;await sleep(100);}
 await evaluate('document.querySelector("button").click()');for(let i=0;i<50&&counts.approved<1;i++)await sleep(100);await sleep(400);
 let returnLink=false;if(!legacy){returnLink=await evaluate('!!document.querySelector("a[rel=noreferrer]")');assert.equal(returnLink,true);await evaluate('document.querySelector("a").click()');for(let i=0;i<50&&counts.callback<1;i++)await sleep(100);}
 assert.equal(counts.approved,1);assert.equal(counts.callback,legacy?0:1);if(legacy)assert.ok(cspViolations>0,'Chrome reports blocked cross-origin form redirect');
 console.log(JSON.stringify({synthetic:true,productionRequests:0,legacy302:legacy,strictCsp:policy,counts,returnLink,cspViolations,callbackOriginMappedOnlyForLoopback:true,personalSessionUsed:false,pass:true}));
}finally{ws?.close();if(child){child.kill('SIGTERM');await Promise.race([new Promise(r=>child.once('exit',r)),sleep(2000)]);}await new Promise(r=>server.close(r));rmSync(profile,{recursive:true,force:true});}
