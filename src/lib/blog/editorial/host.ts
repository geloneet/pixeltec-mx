import {db} from '@/lib/db';
import {auth} from '@/lib/auth/config';
import {resolveAuthority} from '@/lib/auth/authority';
import {getUserDisplayName} from '@/lib/blog/pg';
import {serializePost} from '@/lib/blog/queries/posts';
import {blogPosts} from '@/lib/db/schema';
import {eq} from 'drizzle-orm';
import {normalizeCandidate,validatePostForPublication} from '@/lib/blog/publication-gate';
import {revalidatePath} from 'next/cache';
import {createEditorialService} from './service.mjs';
// This identity is host-only. Passing a userId/role from a tool or browser
// never selects a session; auth and canonical authority are re-read below.
export const editorialSessionIdentity=Symbol('canonical-editorial-session');
export const editorialService=createEditorialService({
 sql:db.$client,
 authorize:async(identity:unknown)=>{
  if(identity!==editorialSessionIdentity)return null;
  const s=await auth();if(!s?.user?.id)return null;
  const a=await resolveAuthority(s.user.id,s.user.credentialIssuedAt);if(!a.ok)return null;
  return {userId:a.userId,role:a.role,name:await getUserDisplayName(a.userId)};
 },
 publicationGate:(candidate:Parameters<typeof normalizeCandidate>[0])=>validatePostForPublication(normalizeCandidate(candidate)),
 invalidate:async(paths:string[])=>{for(const path of paths)revalidatePath(path);},
});
export async function readEditorialView(id:string) {
 const revision=await editorialService.read(editorialSessionIdentity,id);
 const [row]=await db.select().from(blogPosts).where(eq(blogPosts.id,revision.id)).limit(1);
 if(!row)throw new Error('EDITORIAL_NOT_FOUND');
 const post=serializePost(row);
 return {post:{...post,...revision.content,id:revision.id,ai:{...post.ai,...revision.content.ai},seo:{...post.seo,...revision.content.seo,noindex:revision.content.seo.noindex??false},author:revision.author,status:post.status,scheduledAt:revision.scheduledAt,updatedAt:revision.updatedAt},version:revision.version,digest:revision.digest,reviewed:revision.reviewed};
}
