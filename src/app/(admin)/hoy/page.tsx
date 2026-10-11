import type { Metadata } from 'next';
import { CommercialPage } from '@/components/commercial/commercial-page';
export const metadata: Metadata = { title: 'Inicio — PixelTEC' };
export default function Page() { return <CommercialPage view="home"/>; }
