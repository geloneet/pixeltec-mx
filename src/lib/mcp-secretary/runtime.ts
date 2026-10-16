import {createPrivateKey,createPublicKey} from 'node:crypto';
import {createNodeOAuthHandler} from './issuer-mount';
import {runtimeConfig,disabledResponse} from './runtime-config.mjs';
import {discoveryConfig,bootstrapChallenge} from './discovery-config.mjs';

/** Shared instance per Next worker. Does not read config during build/import.
 * Keys are operator-injected only after exact approval; no key creation or DDL.
 * Failed initialization is retriable and never cached as a working instance. */
// Environment changes require worker restart; DB revocation remains immediate.
let instance:Promise<any>|undefined;
export async function commercialRuntime(){
 if(typeof window!=='undefined')throw new Error('SERVER_RUNTIME_REQUIRED');
 const config=runtimeConfig(process.env);if(!config)return null;
 if(!instance)instance=Promise.resolve().then(()=>{
  const signingKey=createPrivateKey(config.privatePem),verificationKey=createPublicKey(config.publicPem);
  if(signingKey.asymmetricKeyType!=='rsa'||verificationKey.asymmetricKeyType!=='rsa'||(signingKey.asymmetricKeyDetails?.modulusLength??0)<2048)throw new Error('MCP_KEY_INVALID');
  const derived=createPublicKey(signingKey).export({format:'der',type:'spki'});
  if(!derived.equals(verificationKey.export({format:'der',type:'spki'})))throw new Error('MCP_KEY_INVALID');
  const oauth=createNodeOAuthHandler({...config,signingKey,verificationKey});
  return{oauth,config};
 }).catch(error=>{instance=undefined;throw error;});
 return instance;
}
export async function mcpRequest(request:Request){
 try {const r=await commercialRuntime();if(!r){const publicConfig=discoveryConfig(process.env);return publicConfig?bootstrapChallenge(publicConfig,request):disabledResponse();}
  if(!r.mcp){const [{createCommercialMcp},{canonicalChannelTools}]=await Promise.all([import('./mount'),import('./channels')]);const {config,oauth}=r;
   const extra=canonicalChannelTools({resolveGrant:i=>oauth.provider.resolveGrant(i),tenantBindings:config.tenantBindings,audit:(owner,action,status)=>oauth.provider.store.audit(owner,action,null,status)});
   const mcp=createCommercialMcp({hosts:config.hosts,origins:config.origins,resourceMetadataUrl:config.issuer+'.well-known/oauth-protected-resource/api/mcp',
   authenticate:async request=>{
    const match=/^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization')||'');if(!match)return null;
    const t=await oauth.provider.verifyAccessToken(match[1]);return{issuer:t.extra.issuer,subject:t.extra.subject,scopes:t.scopes};
   },resolveGrant:i=>oauth.provider.resolveGrant(i),enableFollowupWrites:false,registerExtraTools:extra});
   r.mcp=mcp;
  }return await r.mcp.handle(request);}
 catch{return Response.json({error:'mcp_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function discovery(kind:'authorization'|'resource'){
 try{const config=discoveryConfig(process.env);if(!config)return disabledResponse();
 const base=config.issuer;
 const metadata=kind==='resource'?{resource:config.resource,authorization_servers:[base],scopes_supported:config.allowedScopes,bearer_methods_supported:['header']}:
 {issuer:base,authorization_endpoint:base+'api/oauth/authorize',token_endpoint:base+'api/oauth/token',revocation_endpoint:base+'api/oauth/revoke',jwks_uri:base+'api/oauth/jwks',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],revocation_endpoint_auth_methods_supported:['none'],scopes_supported:config.allowedScopes};
 return Response.json(metadata,{headers:{'Cache-Control':'no-store'}});
 }catch{return disabledResponse();}
}
