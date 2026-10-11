import type { Metadata } from 'next';
import { CommercialPage } from '@/components/commercial/commercial-page';
export const metadata: Metadata = { title: 'Cobros — PixelTEC' };
export default function Page() { return <CommercialPage view="billing"/>; }
