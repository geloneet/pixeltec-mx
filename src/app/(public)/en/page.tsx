import {CubePosterPreload} from '@/components/public-site/cube-poster';
import extras from '@/components/public-site/generated/home-extras-en.json';
import {PublicTree,type PublicNode} from '@/components/public-site/tree';
import {homePosts} from '@/components/public-site/home-posts';
import Home from '@/components/public-site/generated/home-en';
export const metadata={title:'Web & App Development and AI Automation | PixelTEC',robots:{index:false,follow:true}};
export default async function Page(){const posts=await homePosts();return <><CubePosterPreload/><main id="main"><Home posts={posts}/></main>{(extras as unknown as PublicNode[]).map((node,i)=><PublicTree key={i} node={node}/>)}</>;}
