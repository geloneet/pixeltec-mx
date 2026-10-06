import PublicLayout from './(public)/layout';
import {PublicPage} from '@/components/public-site/page';
export const metadata={title:'Página no encontrada',robots:{index:false,follow:true}};
export default function NotFound(){return <PublicLayout><PublicPage path="/404"/></PublicLayout>;}
