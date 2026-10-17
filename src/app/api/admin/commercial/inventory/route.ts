import {requireAdmin} from '@/lib/auth-guards';
import {db} from '@/lib/db';
import {readCommercialInventory} from '@/lib/commercial/inventory.mjs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
 const guard=await requireAdmin(undefined,{route:'/api/admin/commercial/inventory'});
 if(!guard.ok) return Response.json({error:guard.error},{status:guard.status,headers:{'Cache-Control':'no-store'}});
 // No tenant/owner/query filter supplied by a caller can broaden this read.
 if(new URL(request.url).search) return Response.json({error:'QUERY_PARAMETERS_NOT_SUPPORTED'},{status:400,headers:{'Cache-Control':'no-store'}});
 try{return Response.json(await readCommercialInventory(db.$client,guard.uid),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'INVENTORY_UNAVAILABLE',coverage:{complete:false},completeForDestructiveAction:false},{status:503,headers:{'Cache-Control':'no-store'}});}
}
