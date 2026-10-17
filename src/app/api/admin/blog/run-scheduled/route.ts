import {requireAdmin} from '@/lib/auth-guards';
import {isCommercialOriginAllowed} from '@/lib/commercial/origin';
import {editorialService,editorialSessionIdentity} from '@/lib/blog/editorial/host';
export const dynamic='force-dynamic';
// Explicit authenticated operation, never GET. No scheduler, service token,
// grant or transport is provisioned by adding this handler.
export async function POST(request:Request) {
 if(!isCommercialOriginAllowed(request))return Response.json({error:'ORIGIN_DENIED'},{status:403});
 const guard=await requireAdmin(undefined,{route:'/api/admin/blog/run-scheduled'});
 if(!guard.ok)return Response.json({error:guard.error},{status:guard.status});
 try{return Response.json({results:await editorialService.runDue(editorialSessionIdentity),schedulerInstalled:false},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'EDITORIAL_RUNNER_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
