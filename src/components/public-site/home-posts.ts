import {getPublishedPosts} from '@/lib/blog/queries/posts';
export async function homePosts(){
 const posts=await getPublishedPosts();
 return posts.slice(0,4).map(post=>({href:`/blog/${post.slug}`,cat:post.category,date:new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',year:'numeric'}).format(new Date(post.publishedAt??post.createdAt)),title:post.title,excerpt:post.excerpt}));
}
