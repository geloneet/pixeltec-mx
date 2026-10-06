import {homePosts} from '@/components/public-site/home-posts';
import {buildMetadata} from '@/lib/seo';
import {HOME_SEO} from '@/lib/content/home';
export const metadata=buildMetadata({path:'/',title:HOME_SEO.title,description:HOME_SEO.description});
import Home from '@/components/public-site/generated/home';
import extras from '@/components/public-site/generated/home-extras.json';
import {PublicTree,type PublicNode} from '@/components/public-site/tree';
import {HomeStructuredData} from '@/components/seo/home-structured-data';
export default async function Page(){const posts=await homePosts();return <><HomeStructuredData/><main id="main"><Home posts={posts}/></main>{(extras as unknown as PublicNode[]).map((node,i)=><PublicTree key={i} node={node}/>)}</>;}
