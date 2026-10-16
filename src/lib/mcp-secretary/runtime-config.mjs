/** Parse only explicitly supplied server configuration. Never creates credentials
 * or defaults to active. Error messages intentionally contain no config values. */
export function runtimeConfig(env) {
 if(env.PIXELTEC_MCP_ENABLED!=='true')return null;
 try {
  const issuer='https://pixeltec.mx/';
  const clients=JSON.parse(env.PIXELTEC_MCP_CLIENTS_JSON||'null');
  const approvedUserIds=JSON.parse(env.PIXELTEC_MCP_APPROVED_USERS_JSON||'null');
  const origins=JSON.parse(env.PIXELTEC_MCP_ORIGINS_JSON||'[]');
  if(!Array.isArray(clients)||clients.length!==1||!Array.isArray(approvedUserIds)||approvedUserIds.length!==1||!approvedUserIds.every(x=>/^[a-f0-9-]{36}$/i.test(x)))throw 0;
  if(!Array.isArray(origins)||origins.some(x=>typeof x!=='string'||new URL(x).origin!==x||new URL(x).protocol!=='https:'))throw 0;
  const client=clients[0];
  const allowedScopes=JSON.parse(env.PIXELTEC_MCP_SCOPES_JSON||'[\"crm:read\"]');
  const supported=['crm:read','channels:email:read','channels:whatsapp:read'];
  if(!Array.isArray(allowedScopes)||!allowedScopes.length||new Set(allowedScopes).size!==allowedScopes.length||allowedScopes.some(x=>!supported.includes(x)))throw 0;
  const tenantBindings=JSON.parse(env.PIXELTEC_MCP_TENANT_BINDINGS_JSON||'{}');
  if(!tenantBindings||Array.isArray(tenantBindings)||typeof tenantBindings!=='object'||Object.entries(tenantBindings).some(([u,t])=>!approvedUserIds.includes(u)||typeof t!=='string'||!t.trim()||t.length>200))throw 0;
  if(allowedScopes.includes('channels:whatsapp:read')&&(!env.PIXELBOT_TENANT_ID||tenantBindings[approvedUserIds[0]]!==env.PIXELBOT_TENANT_ID))throw 0;
  if(typeof client.client_id!=='string'||!client.client_id.trim()||client.token_endpoint_auth_method!=='none'||typeof client.scope!=='string'||client.scope.split(' ').length!==allowedScopes.length||new Set(client.scope.split(' ')).size!==allowedScopes.length||client.scope.split(' ').some(x=>!allowedScopes.includes(x))||!Array.isArray(client.redirect_uris)||client.redirect_uris.length!==1||client.redirect_uris.some(x=>new URL(x).protocol!=='https:'||new URL(x).hash||x.includes('*')))throw 0;
  if(!env.PIXELTEC_MCP_PRIVATE_KEY_PEM?.includes('BEGIN PRIVATE KEY')||!env.PIXELTEC_MCP_PUBLIC_KEY_PEM?.includes('BEGIN PUBLIC KEY')||!env.PIXELTEC_MCP_KEY_ID?.match(/^[A-Za-z0-9_-]{1,80}$/))throw 0;
  return {allowedScopes,tenantBindings,issuer,resource:issuer+'api/mcp',clients,approvedUserIds,origins,hosts:['pixeltec.mx'],keyId:env.PIXELTEC_MCP_KEY_ID,privatePem:env.PIXELTEC_MCP_PRIVATE_KEY_PEM,publicPem:env.PIXELTEC_MCP_PUBLIC_KEY_PEM};
 }catch{throw new Error('MCP_CONFIGURATION_INVALID');}
}
export const disabledResponse=()=>Response.json({error:'mcp_not_active'},{status:503,headers:{'Cache-Control':'no-store'}});
