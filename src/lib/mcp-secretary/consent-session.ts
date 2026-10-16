/** Future Next server request adapter. It reads the existing Auth.js session;
 * does not sign in, alter MFA, mint cookies or accept session fields from tools. */
import {auth} from '@/lib/auth/config';
import {resolveAuthority} from '@/lib/auth/authority';
import {db} from '@/lib/db';
import {userSessions} from '@/lib/db/schema';
import {and,eq} from 'drizzle-orm';
import type {NextApiRequest,NextApiResponse} from 'next';
export async function canonicalConsentSession(context?:{req:NextApiRequest;res:NextApiResponse}){
 const session=context?await auth(context.req,context.res):await auth(),user=session?.user;
 if(!user?.id||!user.sid||!Number.isInteger(user.credentialIssuedAt))return null;
 const current=await resolveAuthority(user.id,user.credentialIssuedAt);
 if(!current.ok||!['admin','staff'].includes(current.role))return null;
 // Unlike legacy availability-oriented session validation, new consent must
 // fail closed if the session row cannot be read. Exceptions are not swallowed.
 const [row]=await db.select({revokedAt:userSessions.revokedAt}).from(userSessions)
  .where(and(eq(userSessions.id,user.sid),eq(userSessions.userId,user.id))).limit(1);
 if(!row||row.revokedAt)return null;
 return{sessionId:user.sid,userId:user.id,credentialIssuedAt:user.credentialIssuedAt!};
}
