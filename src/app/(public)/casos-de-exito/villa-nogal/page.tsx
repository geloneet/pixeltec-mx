import {PublicPage,publicPage} from '@/components/public-site/page';
import {buildMetadata} from '@/lib/seo';
const path="/casos-de-exito/villa-nogal";
const info=publicPage(path)!;
export const metadata=buildMetadata({path,title:info.title.replace(/ \| PixelTEC$/, ''),description:info.description});
export default function Page(){return <PublicPage path={path}/>;}
