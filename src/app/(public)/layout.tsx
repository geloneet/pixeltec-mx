import {PublicChrome} from '@/components/public-site/chrome';
import type {ReactNode} from 'react';
import {PublicInteractions} from '@/components/public-site/interactions';
import '@/components/public-site/public.css';
import '@/components/public-site/overrides.css';
export default function PublicLayout({children}:{children:ReactNode}){
 return <PublicInteractions><PublicChrome part="header"/><div data-route-content>{children}</div><PublicChrome part="footer"/><PublicChrome part="extras"/></PublicInteractions>;
}
