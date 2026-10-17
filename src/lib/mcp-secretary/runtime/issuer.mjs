import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {dependency} from './dependencies.mjs';
const [{SignJWT,jwtVerify,exportJWK},{InvalidGrantError,InvalidRequestError,InvalidScopeError,AccessDeniedError}]=await Promise.all([
 dependency('jose'),dependency('@modelcontextprotocol/sdk/server/auth/errors.js'),
]);
const hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('base64url');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Candidate OAuthServerProvider for the official SDK handlers.
 * Keys, pre-registered clients and session/authority adapters are injected.
 * Never generates a signing key, reads credentials, registers a client,
 * binds a port or creates a production consent grant on construction. */
export class CommercialIssuer {
 constructor({store,issuer,resource,clients,approvedUserIds,signingKey,verificationKey,keyId,session,userAuthority,allowedScopes=['crm:read'],clock=Date.now}) {
  const url=new URL(issuer);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||signingKey?.type!=='private'||verificationKey?.type!=='public'||!session||!userAuthority||!keyId)throw new Error('ISSUER_CONFIGURATION_REQUIRED');
  this.issuer=url.href;this.resource=new URL(resource).href;this.origin=url.origin;
  if(new URL(this.resource).origin!==this.origin)throw new Error('RESOURCE_CONFIGURATION_REQUIRED');
  Object.assign(this,{signingKey,verificationKey,keyId,session,userAuthority,clock});
  if(!Array.isArray(approvedUserIds)||!approvedUserIds.length||approvedUserIds.some(id=>typeof id!=='string'||!id.trim()))throw new Error('APPROVED_USERS_REQUIRED');
  this.approvedUserIds=new Set(approvedUserIds);
  const supported=['crm:read','channels:email:read','channels:whatsapp:read'];
  if(!Array.isArray(allowedScopes)||!allowedScopes.length||allowedScopes.some(x=>!supported.includes(x)))throw new Error('SCOPE_CONFIGURATION_REQUIRED');
  this.allowedScopes=[...new Set(allowedScopes)];
  const registered=new Map(clients.map(client=>{
   if(client.token_endpoint_auth_method!=='none'||!client.redirect_uris?.length||client.redirect_uris.some(u=>new URL(u).protocol!=='https:'||new URL(u).hash||u.includes('*'))||typeof client.scope!=='string'||client.scope.split(' ').some(x=>!this.allowedScopes.includes(x)))throw new Error('CLIENT_CONFIGURATION_REQUIRED');
   return[client.client_id,structuredClone(client)];
  }));
  // No registerClient method: dynamic client registration is disabled.
  this.clientsStore={getClient:async id=>{const c=registered.get(id);return c?structuredClone(c):undefined;}};
  if(!store?.atomic)throw new Error('POSTGRES_STORE_REQUIRED');this.store=store;
 }
 async audit(user,ref,event,store=this.store){await store.audit(user,event,ref,'ok','oauth',this.clock());}
 async currentSession(req){const s=await this.session(req);if(!s?.sessionId||!s.userId||!Number.isInteger(s.credentialIssuedAt))throw new AccessDeniedError('Sign-in required');await this.checkUser(s.userId,s.credentialIssuedAt);return s;}
 async checkUser(userId,epoch){if(!this.approvedUserIds.has(userId))throw new AccessDeniedError('Access denied');const a=await this.userAuthority(userId,epoch);if(!this.approvedUserIds.has(userId)||!a?.ok||!['admin','staff'].includes(a.role))throw new AccessDeniedError('Access denied');}
 checkRequest(client,params){
  if(!client.redirect_uris.includes(params.redirectUri))throw new InvalidRequestError('Invalid redirect');
  if(params.resource?.href!==this.resource)throw new InvalidRequestError('Invalid resource');
  if(!params.scopes?.length||new Set(params.scopes).size!==params.scopes.length||params.scopes.some(x=>!this.allowedScopes.includes(x)||!client.scope.split(' ').includes(x)))throw new InvalidScopeError('Requested scope unavailable');
  if(!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge)||typeof params.state!=='string'||!params.state||params.state.length>1024)throw new InvalidRequestError('PKCE S256 and state required');
 }
 async authorize(client,params,res){
  this.checkRequest(client,params);
  const s=await this.currentSession(res.req),id=randomUUID();
  const request={clientId:client.client_id,redirectUri:params.redirectUri,resource:params.resource.href,scopes:params.scopes,challenge:params.codeChallenge,state:params.state};
  (await this.store.run('INSERT INTO mcp_secretary.pending(id,session_hash,user_id,credential_epoch,request,expires) VALUES($1,$2,$3,$4,$5,$6)',id,hash(s.sessionId),s.userId,s.credentialIssuedAt,JSON.stringify(request),this.clock()+300000));
  await this.audit(s.userId,id,'consent_requested');
  res.redirect(new URL('/api/oauth/consentimiento?flow='+id,this.issuer).href);
 }
 async consentPage(req,res){
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");
  const s=await this.currentSession(req),p=(await this.store.one('SELECT * FROM mcp_secretary.pending WHERE id=$1',req.query.flow));
  if(!p||p.used||p.expires<=this.clock()||p.user_id!==s.userId||p.session_hash!==hash(s.sessionId))throw new AccessDeniedError('Consent unavailable');
  const csrf=secret();(await this.store.run('UPDATE mcp_secretary.pending SET csrf_hash=$1 WHERE id=$2',hash(csrf),p.id));
  const requested=JSON.parse(p.request),client=await this.clientsStore.getClient(requested.clientId);
  res.type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Autorizar lecturas comerciales</title><h1>Permitir las lecturas seleccionadas</h1><p>Cliente: '+escape(client.client_name||client.client_id)+'. Destino: '+escape(new URL(requested.redirectUri).origin)+'.</p><p>Contactos: nombre, estado y próximo paso. Oportunidades: necesidad, etapa y seguimiento. Proyectos: nombre, etapa y próximo paso. Cotizaciones: folio, título y estado. Sin cobros, importes o escrituras. Correo y WhatsApp, sólo si aparecen en los scopes solicitados, incluyen metadatos y texto de conversaciones autorizadas; no envían ni marcan leído.</p><p>Scopes: '+escape(requested.scopes.join(' '))+'</p><p>Acceso revocable durante 7 días. Tokens de 15 minutos.</p><form method="post" action="/api/oauth/consent"><input type="hidden" name="flow" value="'+escape(p.id)+'"><input type="hidden" name="csrf" value="'+escape(csrf)+'"><button name="decision" value="approve">Autorizar estas lecturas</button><button name="decision" value="deny">Cancelar</button></form></html>');
 }
 async consent(req,res){
  if(req.headers.origin!==this.origin)throw new AccessDeniedError('Invalid origin');
  const s=await this.currentSession(req),p=(await this.store.one('SELECT * FROM mcp_secretary.pending WHERE id=$1',req.body.flow));
  if(!p||p.used||p.expires<=this.clock()||p.user_id!==s.userId||p.session_hash!==hash(s.sessionId)||!p.csrf_hash||!same(p.csrf_hash,hash(req.body.csrf||''))||!['approve','deny'].includes(req.body.decision))throw new AccessDeniedError('Consent unavailable');
  const request=JSON.parse(p.request),redirect=new URL(request.redirectUri);
  const registered=await this.clientsStore.getClient(request.clientId);this.checkRequest(registered,{...request,scopes:request.scopes,codeChallenge:request.challenge,resource:new URL(request.resource)});
  redirect.searchParams.set('state',request.state);
  let code;
  await this.store.atomic(async tx=>{
   const claim=(await tx.run('UPDATE mcp_secretary.pending SET used=1 WHERE id=$1 AND used=0 RETURNING id',p.id));if(claim.changes!==1)throw new AccessDeniedError('Consent consumed');
   if(req.body.decision==='deny'){await this.audit(s.userId,p.id,'consent_denied',tx);return;}
   const grantId=randomUUID(),subject=randomUUID();code=secret();
   (await tx.run('INSERT INTO mcp_secretary.grants(id,subject,user_id,credential_epoch,client,expires,scopes) VALUES($1,$2,$3,$4,$5,$6,$7)',grantId,subject,s.userId,s.credentialIssuedAt,request.clientId,this.clock()+604800000,JSON.stringify(request.scopes)));
   (await tx.run('INSERT INTO mcp_secretary.codes(hash,grant_id,request,expires) VALUES($1,$2,$3,$4)',hash(code),grantId,JSON.stringify(request),this.clock()+60000));
   await this.audit(s.userId,grantId,'consent_approved',tx);
  });
  redirect.searchParams.set(code?'code':'error',code||'access_denied');
  // Keep form-action self: Chrome applies it to a form POST's cross-origin
  // redirect chain. Finish the POST locally; an explicit top-level link returns
  // to the already validated exact OAuth callback. No extra grant or endpoint.
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  res.type('html').send('<!doctype html><html lang="es"><meta charset="utf-8"><title>Volver a ChatGPT</title><h1>'+ (code?'Lecturas autorizadas':'Autorización cancelada')+'</h1><p>Completa el retorno ahora.'+(code?' El enlace vence en 60 segundos.':'')+'</p><a rel="noreferrer" href="'+escape(redirect.href)+'">Volver a ChatGPT</a></html>');
 }
 async getCode(client,code){const c=(await this.store.one('SELECT * FROM mcp_secretary.codes WHERE hash=$1',hash(code)));if(!c||(!c.used&&c.expires<=this.clock()))throw new InvalidGrantError('Invalid code');const request=JSON.parse(c.request);if(request.clientId!==client.client_id)throw new InvalidGrantError('Invalid client');return{...c,request};}
 async challengeForAuthorizationCode(client,code){return (await this.getCode(client,code)).request.challenge;}
 async revokeFamily(store,g,event){await store.run('UPDATE mcp_secretary.grants SET revoked=1 WHERE id=$1',g.id);await this.audit(g.user_id,g.id,event,store);}
 async grant(id){const g=(await this.store.one('SELECT * FROM mcp_secretary.grants WHERE id=$1',id));if(!g||g.revoked||g.expires<=this.clock())throw new InvalidGrantError('Grant unavailable');await this.checkUser(g.user_id,g.credential_epoch);const scopes=JSON.parse(g.scopes);if(!Array.isArray(scopes)||!scopes.length||scopes.some(x=>!this.allowedScopes.includes(x)))throw new InvalidGrantError('Grant unavailable');return{...g,grantedScopes:scopes};}
 async issue(g,refresh){
  g={...g,grantedScopes:JSON.parse(g.scopes)};if(!Array.isArray(g.grantedScopes)||g.grantedScopes.some(x=>!this.allowedScopes.includes(x)))throw new InvalidGrantError('Grant unavailable');
  const now=Math.floor(this.clock()/1000),expires=Math.min(now+900,Math.floor(g.expires/1000));
  const access=await new SignJWT({scope:g.grantedScopes.join(' ')}).setProtectedHeader({alg:'RS256',kid:this.keyId,typ:'at+jwt'}).setIssuer(this.issuer).setAudience(this.resource).setSubject(g.subject).setJti(randomUUID()).setIssuedAt(now).setExpirationTime(expires).sign(this.signingKey);
  return{access_token:access,token_type:'Bearer',expires_in:expires-now,scope:g.grantedScopes.join(' '),refresh_token:refresh};
 }
 async exchangeAuthorizationCode(client,code,_verifier,redirectUri,resource){
  // Only called behind official SDK PKCE validation. Grant-first lock order
  // serializes exchanges/revocation. Commit replay revocation before error.
  const c=await this.getCode(client,code);
  if(redirectUri!==c.request.redirectUri||resource?.href!==this.resource)throw new InvalidGrantError('Binding mismatch');
  await this.grant(c.grant_id); // Authority reads do not hold a transaction/pool slot.
  const refresh=secret();
  const outcome=await this.store.atomic(async tx=>{
   const g=await tx.one('SELECT * FROM mcp_secretary.grants WHERE id=$1 FOR UPDATE',c.grant_id);
   if(!g||g.revoked||g.expires<=this.clock())return null;
   if(!this.approvedUserIds.has(g.user_id))throw new AccessDeniedError('Access denied');
   const locked=await tx.one('SELECT * FROM mcp_secretary.codes WHERE hash=$1 FOR UPDATE',hash(code));
   if(!locked)return null;
   if(locked.used){await this.revokeFamily(tx,g,'code_reuse_revoked');return null;}
   if(locked.expires<=this.clock())return null;
   await tx.run('UPDATE mcp_secretary.codes SET used=1 WHERE hash=$1',hash(code));
   await tx.run('INSERT INTO mcp_secretary.refresh(hash,grant_id,expires) VALUES($1,$2,$3)',hash(refresh),g.id,g.expires);
   await this.audit(g.user_id,g.id,'code_exchanged',tx);return g;
  });
  if(!outcome)throw new InvalidGrantError('Code unavailable');
  return this.issue(outcome,refresh);
 }
 async exchangeRefreshToken(client,token,scopes,resource){
  const r=await this.store.one('SELECT * FROM mcp_secretary.refresh WHERE hash=$1',hash(token));
  if(!r||r.expires<=this.clock()||resource?.href!==this.resource)throw new InvalidGrantError('Refresh unavailable');
  const authorized=await this.grant(r.grant_id);
  if(scopes&&(scopes.length!==authorized.grantedScopes.length||new Set(scopes).size!==scopes.length||scopes.some(x=>!authorized.grantedScopes.includes(x))))throw new InvalidScopeError('Invalid scope');
  if(authorized.client!==client.client_id)throw new InvalidGrantError('Binding mismatch');
  const next=secret();
  const outcome=await this.store.atomic(async tx=>{
   const g=await tx.one('SELECT * FROM mcp_secretary.grants WHERE id=$1 FOR UPDATE',r.grant_id);
   if(!g||g.client!==client.client_id||g.revoked||g.expires<=this.clock())return null;
   if(!this.approvedUserIds.has(g.user_id))throw new AccessDeniedError('Access denied');
   const locked=await tx.one('SELECT * FROM mcp_secretary.refresh WHERE hash=$1 FOR UPDATE',hash(token));
   if(!locked||locked.expires<=this.clock())return null;
   if(locked.used){await this.revokeFamily(tx,g,'refresh_reuse_revoked');return null;}
   await tx.run('UPDATE mcp_secretary.refresh SET used=1 WHERE hash=$1',hash(token));
   await tx.run('INSERT INTO mcp_secretary.refresh(hash,grant_id,expires) VALUES($1,$2,$3)',hash(next),g.id,g.expires);
   await this.audit(g.user_id,g.id,'refresh_rotated',tx);return g;
  });
  if(!outcome)throw new InvalidGrantError('Refresh unavailable');
  return this.issue(outcome,next);
 }
 async verifyAccessToken(token){
  try{const {payload,protectedHeader}=await jwtVerify(token,this.verificationKey,{issuer:this.issuer,audience:this.resource,algorithms:['RS256'],currentDate:new Date(this.clock()),requiredClaims:['exp','iat','sub','jti']});
   if(protectedHeader.kid!==this.keyId||typeof payload.scope!=='string')throw 0;
   const row=(await this.store.one('SELECT id FROM mcp_secretary.grants WHERE subject=$1',payload.sub));if(!row)throw 0;const g=await this.grant(row.id);
   if(payload.scope!==g.grantedScopes.join(' '))throw 0;
   return{token,clientId:g.client,scopes:g.grantedScopes,expiresAt:payload.exp,resource:new URL(this.resource),extra:{issuer:this.issuer,subject:g.subject,userId:g.user_id,credentialIssuedAt:g.credential_epoch}};
  }catch{throw new InvalidGrantError('Access unavailable');}
 }
 async resolveGrant(identity){
  if(identity.issuer!==this.issuer)return null;
  const row=(await this.store.one('SELECT id FROM mcp_secretary.grants WHERE subject=$1',identity.subject));if(!row)return null;
  try{const g=await this.grant(row.id);return{userId:g.user_id,credentialIssuedAt:g.credential_epoch,scopes:g.grantedScopes,expiresAt:g.expires,revoked:false};}catch{return null;}
 }
 async revokeToken(client,request){
  let grantId;const r=(await this.store.one('SELECT grant_id FROM mcp_secretary.refresh WHERE hash=$1',hash(request.token)));
  if(r)grantId=r.grant_id;
  else{try{const a=await this.verifyAccessToken(request.token);const g=(await this.store.one('SELECT id FROM mcp_secretary.grants WHERE subject=$1',a.extra.subject));grantId=g?.id;}catch{return;}}
  const g=(await this.store.one('SELECT * FROM mcp_secretary.grants WHERE id=$1',grantId));
  if(g?.client===client.client_id)await this.store.atomic(async tx=>{await this.revokeFamily(tx,g,'grant_revoked');});
 }
 async connectionsPage(req,res){
  const s=await this.currentSession(req);
  const rawPage=req.query.page??'0';if(typeof rawPage!=='string'||!/^\d{1,6}$/.test(rawPage))throw new AccessDeniedError('Invalid page');
  const page=Number(rawPage),pageSize=25;
  const rows=(await this.store.all('SELECT * FROM mcp_secretary.grants WHERE user_id=$1 ORDER BY seq DESC LIMIT $2 OFFSET $3',s.userId,pageSize+1,page*pageSize));
  const grants=rows.slice(0,pageSize);
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action 'self'; frame-ancestors 'none'");
  let html='<!doctype html><html lang="es"><meta charset="utf-8"><title>Conexiones del CRM</title><h1>Conexiones de tu cartera</h1>';
  for(const g of grants){html+='<section><h2>'+escape(g.client)+'</h2><p>crm:read · '+escape(new Date(g.expires).toISOString())+' · '+(g.revoked?'Revocada':'Vigente')+'</p>';
   if(!g.revoked){const id=randomUUID(),csrf=secret();(await this.store.run('INSERT INTO mcp_secretary.disconnect(id,user_id,session_hash,grant_id,csrf_hash,expires) VALUES($1,$2,$3,$4,$5,$6)',id,s.userId,hash(s.sessionId),g.id,hash(csrf),this.clock()+300000));html+='<form method="post" action="/api/oauth/desconectar"><input type="hidden" name="flow" value="'+escape(id)+'"><input type="hidden" name="csrf" value="'+escape(csrf)+'"><button>Revocar conexión</button></form>';}
   html+='</section>';
  }
  if(page>0)html+='<a href="/api/oauth/conexiones?page='+(page-1)+'">Anteriores</a>';
  if(rows.length>pageSize)html+='<a href="/api/oauth/conexiones?page='+(page+1)+'">Más conexiones</a>';
  res.type('html').send(html);
 }
 async disconnect(req,res){
  if(req.headers.origin!==this.origin)throw new AccessDeniedError('Invalid origin');
  const s=await this.currentSession(req),d=(await this.store.one('SELECT * FROM mcp_secretary.disconnect WHERE id=$1',req.body.flow));
  if(!d||d.used||d.expires<=this.clock()||d.user_id!==s.userId||d.session_hash!==hash(s.sessionId)||!same(d.csrf_hash,hash(req.body.csrf||'')))throw new AccessDeniedError('Unavailable');
  await this.store.atomic(async tx=>{if((await tx.run('UPDATE mcp_secretary.disconnect SET used=1 WHERE id=$1 AND used=0 RETURNING id',d.id)).changes!==1)throw new AccessDeniedError('Consumed');(await tx.run('UPDATE mcp_secretary.grants SET revoked=1 WHERE id=$1 AND user_id=$2',d.grant_id,s.userId));await this.audit(s.userId,d.grant_id,'owner_disconnected',tx);});
  res.redirect('/api/oauth/conexiones');
 }
 close(){} // Pool owned by host.
}

export async function issuerApp(provider){
 const [{default:express},{authorizationHandler},{tokenHandler},{revocationHandler},{createOAuthMetadata,mcpAuthMetadataRouter}]=await Promise.all([
  dependency('express'),dependency('@modelcontextprotocol/sdk/server/auth/handlers/authorize.js'),dependency('@modelcontextprotocol/sdk/server/auth/handlers/token.js'),dependency('@modelcontextprotocol/sdk/server/auth/handlers/revoke.js'),dependency('@modelcontextprotocol/sdk/server/auth/router.js'),
 ]);
 const app=express();app.disable('x-powered-by');
 const metadata={...createOAuthMetadata({provider,issuerUrl:new URL(provider.issuer),scopesSupported:provider.allowedScopes}),authorization_endpoint:new URL('/api/oauth/authorize',provider.issuer).href,token_endpoint:new URL('/api/oauth/token',provider.issuer).href,revocation_endpoint:new URL('/api/oauth/revoke',provider.issuer).href,token_endpoint_auth_methods_supported:['none'],revocation_endpoint_auth_methods_supported:['none'],jwks_uri:new URL('/api/oauth/jwks',provider.issuer).href};
 app.use(mcpAuthMetadataRouter({oauthMetadata:metadata,resourceServerUrl:new URL(provider.resource),scopesSupported:provider.allowedScopes}));
 app.use('/api/oauth/authorize',authorizationHandler({provider}));
 app.use('/api/oauth/token',express.urlencoded({extended:false,limit:'8kb'}),(req,res,next)=>{
  if(req.body?.grant_type==='authorization_code'&&!/^[A-Za-z0-9._~-]{43,128}$/.test(req.body.code_verifier||''))return res.status(400).json({error:'invalid_request'});
  next();
 },tokenHandler({provider}));
 app.use('/api/oauth/revoke',revocationHandler({provider}));
 app.get('/api/oauth/jwks',async(_req,res)=>{const jwk=await exportJWK(provider.verificationKey);res.json({keys:[{...jwk,kid:provider.keyId,alg:'RS256',use:'sig'}]});});
 const safe=fn=>async(req,res)=>{try{await fn(req,res);}catch{await provider.audit(null,null,'consent_rejected');res.status(403).json({error:'access_denied'});}};
 app.get('/api/oauth/consentimiento',safe(provider.consentPage.bind(provider)));
 app.post('/api/oauth/consent',express.urlencoded({extended:false,limit:'8kb'}),safe(provider.consent.bind(provider)));
 app.get('/api/oauth/conexiones',safe(provider.connectionsPage.bind(provider)));
 app.post('/api/oauth/desconectar',express.urlencoded({extended:false,limit:'8kb'}),safe(provider.disconnect.bind(provider)));
 return app;
}
