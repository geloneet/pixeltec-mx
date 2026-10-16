import {commercialRuntime} from '@/lib/mcp-secretary/runtime';
export const runtime='nodejs';
export const dynamic='force-dynamic';
async function handle(request:Request){
 try{const r=await commercialRuntime();if(!r)return Response.json({error:'mcp_not_active'},{status:503,headers:{'Cache-Control':'no-store'}});return await r.oauth.handle(request);}
 catch{return Response.json({error:'oauth_unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=handle;
export const POST=handle;
