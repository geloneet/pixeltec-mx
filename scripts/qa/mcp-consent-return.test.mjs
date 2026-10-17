import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {CommercialIssuer,issuerApp} from '../../src/lib/mcp-secretary/runtime/issuer.mjs';
import {expressFetch} from '../../src/lib/mcp-secretary/runtime/express-fetch.mjs';
const keys=generateKeyPairSync('rsa',{modulusLength:2048});
const callback='https://chatgpt.com/connector/oauth/synthetic-only';
const form=x=>new URLSearchParams(x).toString();
async function fixture({state='synthetic-state'}={}){
 const rows={pending:null,grants:0,codes:0,audit:[]};let owner='synthetic-user',clock=1800000000000;
 const store={async run(sql,...a){
  if(sql.startsWith('INSERT INTO mcp_secretary.pending'))rows.pending={id:a[0],session_hash:a[1],user_id:a[2],credential_epoch:a[3],request:a[4],expires:a[5],used:0};
  else if(sql.includes('SET csrf_hash'))rows.pending.csrf_hash=a[0];
  else if(sql.includes('pending SET used')){if(rows.pending.used)return{changes:0};rows.pending.used=1;}
  else if(sql.includes('INSERT INTO mcp_secretary.grants'))rows.grants++;
  else if(sql.includes('INSERT INTO mcp_secretary.codes'))rows.codes++;
  else throw Error('UNEXPECTED_SYNTHETIC_MUTATION');return{changes:1};
 },async one(sql){assert.ok(sql.includes('pending'));return rows.pending;},async atomic(fn){const before=structuredClone(rows);try{return await fn(this);}catch(e){Object.assign(rows,before);throw e;}},async audit(u,event){rows.audit.push(event);}};
 const client={client_id:'synthetic-only',redirect_uris:[callback],token_endpoint_auth_method:'none',scope:'crm:read'};
 const provider=new CommercialIssuer({store,issuer:'https://pixeltec.mx/',resource:'https://pixeltec.mx/api/mcp',clients:[client],approvedUserIds:['synthetic-user'],signingKey:keys.privateKey,verificationKey:keys.publicKey,keyId:'synthetic',session:async()=>({sessionId:'synthetic-session-'+owner,userId:owner,credentialIssuedAt:1}),userAuthority:async()=>({ok:true,role:'admin'}),clock:()=>clock});
 let pageUrl;await provider.authorize(client,{redirectUri:callback,resource:new URL(provider.resource),scopes:['crm:read'],codeChallenge:'a'.repeat(43),state},{req:{},redirect(v){pageUrl=v;}});
 const app=await issuerApp(provider);const page=await expressFetch(app,new Request(pageUrl));assert.equal(page.status,200);const html=await page.text();const csrf=html.match(/name="csrf" value="([^"]+)"/)[1];
 const post=(values={},origin='https://pixeltec.mx')=>expressFetch(app,new Request('https://pixeltec.mx/api/oauth/consent',{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded',accept:'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'},body:form({flow:rows.pending.id,csrf,decision:'approve',...values})}));
 return{rows,post,get:()=>expressFetch(app,new Request(pageUrl)),owner:x=>owner=x,advance:n=>clock+=n};
}
function link(html){const href=html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');return new URL(href);}
test('approved POST ends locally; exact callback link preserves state and single code with strict CSP',async()=>{
 const f=await fixture();const r=await f.post();assert.equal(r.status,200);assert.equal(r.headers.get('location'),null);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('referrer-policy'),'no-referrer');
 assert.equal(r.headers.get('content-security-policy'),"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");const html=await r.text();const u=link(html);assert.equal(u.origin+u.pathname,callback);assert.equal(u.searchParams.get('state'),'synthetic-state');assert.match(u.searchParams.get('code'),/^[A-Za-z0-9_-]{43}$/);assert.ok(!/<script|<form|http-equiv=/i.test(html));assert.equal(f.rows.grants,1);assert.equal(f.rows.codes,1);assert.equal(f.rows.pending.used,1);
 if(process.env.MCP_SYNTHETIC_HTML_OUTPUT)writeFileSync(process.env.MCP_SYNTHETIC_HTML_OUTPUT,html,{mode:0o600});
 assert.equal((await f.post()).status,403);assert.equal((await f.get()).status,403);assert.equal(f.rows.grants,1);assert.equal(f.rows.codes,1);
});
test('denial uses safe return link with error and creates no grant or code',async()=>{const f=await fixture();const r=await f.post({decision:'deny'});assert.equal(r.status,200);const u=link(await r.text());assert.equal(u.origin+u.pathname,callback);assert.equal(u.searchParams.get('error'),'access_denied');assert.equal(u.searchParams.has('code'),false);assert.equal(f.rows.grants,0);assert.equal(f.rows.codes,0);});
test('origin, CSRF, cross-user session, expiry and invalid decision still reject without consuming request',async()=>{for(const type of ['origin','csrf','owner','expired','decision']){const f=await fixture();let values={},origin='https://pixeltec.mx';if(type==='origin')origin='https://evil.invalid';if(type==='csrf')values.csrf='forged';if(type==='owner')f.owner('other-user');if(type==='expired')f.advance(300000);if(type==='decision')values.decision='unexpected';assert.equal((await f.post(values,origin)).status,403,type);assert.equal(f.rows.pending.used,0,type);assert.equal(f.rows.grants,0,type);assert.equal(f.rows.codes,0,type);}});
test('tampered destination rejects before grant and never emits an external link',async()=>{for(const bad of ['https://evil.invalid/callback',callback+'/different','javascript:alert(1)']){const f=await fixture();const request=JSON.parse(f.rows.pending.request);request.redirectUri=bad;f.rows.pending.request=JSON.stringify(request);const r=await f.post();assert.equal(r.status,403);assert.equal(f.rows.grants,0);assert.equal(f.rows.codes,0);assert.equal(f.rows.pending.used,0);assert.ok(!(await r.text()).includes('href='));}});
test('state markup cannot escape link attribute or change the exact callback',async()=>{const state='\"><img src=x onerror=alert(1)>&x=\'quoted\'';const f=await fixture({state});const r=await f.post();assert.equal(r.status,200);const html=await r.text(),u=link(html);assert.equal(u.origin+u.pathname,callback);assert.equal(u.searchParams.get('state'),state);assert.equal((html.match(/href=/g)||[]).length,1);assert.ok(!html.includes('<img'));});
