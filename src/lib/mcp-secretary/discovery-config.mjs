/** Public OAuth bootstrap metadata only. Does not load keys, DB, client IDs or
 * user grants. A separate explicit flag lets the owner obtain the real callback
 * from Plugins before configuring the one exact OAuth client. */
export function discoveryConfig(env){
 if(env.PIXELTEC_MCP_DISCOVERY_ENABLED!=='true'&&env.PIXELTEC_MCP_ENABLED!=='true')return null;
 try{const scopes=JSON.parse(env.PIXELTEC_MCP_SCOPES_JSON||'["crm:read"]');
  if(!Array.isArray(scopes)||!scopes.length||new Set(scopes).size!==scopes.length||scopes.some(s=>!['crm:read','channels:email:read','channels:whatsapp:read'].includes(s)))throw 0;
  return{issuer:'https://pixeltec.mx/',resource:'https://pixeltec.mx/api/mcp',allowedScopes:scopes};
 }catch{throw new Error('MCP_DISCOVERY_CONFIGURATION_INVALID');}
}
export function bootstrapChallenge(config,request){
 if(request&&((request.headers.get('host')||new URL(request.url).host)!==new URL(config.issuer).host||request.headers.has('origin')))return new Response(null,{status:403,headers:{'Cache-Control':'no-store'}});
 return new Response(null,{status:401,headers:{'Cache-Control':'no-store','WWW-Authenticate':`Bearer resource_metadata="${config.issuer}.well-known/oauth-protected-resource/api/mcp"`}});}
