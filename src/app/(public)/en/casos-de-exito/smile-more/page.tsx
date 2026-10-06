import {PublicPage,publicPage} from '@/components/public-site/page';
const path="/en/casos-de-exito/smile-more";
const info=publicPage(path)!;
export const metadata={title:info.title,description:info.description,robots:{index:false,follow:true},alternates:{canonical:'https://pixeltec.mx'+path}};
export default function Page(){return <PublicPage path={path}/>;}
