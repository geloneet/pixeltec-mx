import {PgStore} from './runtime/pg-store.mjs';
import {expressFetch} from './runtime/express-fetch.mjs';
import {db} from '@/lib/db';
import {CommercialIssuer,issuerApp} from './runtime/issuer.mjs';
import {canonicalConsentSession} from './consent-session';
import {resolveAuthority} from '@/lib/auth/authority';
/** App Router adapter. Canonical auth() reads the real request context; SDK
 * handlers retain native Node request/response behavior through expressFetch.
 * No Pages router, extra listener, cookie impersonation or automatic config. */
export function createNodeOAuthHandler(options:{store?:InstanceType<typeof PgStore>;issuer:string;resource:string;clients:any[];approvedUserIds:string[];signingKey:any;verificationKey:any;keyId:string;allowedScopes?:string[]}){
 const provider=new CommercialIssuer({...options,store:options.store??new PgStore(db.$client),userAuthority:resolveAuthority,session:()=>canonicalConsentSession()});
 const app=issuerApp(provider);
 return{provider,handle:async(request:Request)=>{
  const incoming=new URL(request.url),host=request.headers.get('host')||incoming.host;
  if(host!==new URL(options.issuer).host)return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
  // Next may reconstruct a loopback URL behind the existing TLS proxy. Host is
  // checked exactly; all issuer/redirect/resource URLs remain fixed HTTPS.
  const url=new URL(options.issuer);url.pathname=incoming.pathname;url.search=incoming.search;
  if(request.method==='GET'&&url.pathname==='/api/oauth/authorize'&&!await canonicalConsentSession())return Response.redirect(new URL('/login?redirect='+encodeURIComponent(url.pathname+url.search),options.issuer));
  return expressFetch(await app,new Request(url,request));
 },close:()=>provider.close()};
}
