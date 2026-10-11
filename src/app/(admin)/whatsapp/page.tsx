import { requireUserSession } from '@/lib/auth/session';
import { CommercialPage } from '@/components/commercial/commercial-page';
import { clientSchema } from "@/lib/crm-schemas";
import { WhatsAppModule } from "@/components/whatsapp-inbox/WhatsAppModule";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "WhatsApp | Pixeltec.mx",
};

export default async function WhatsAppInboxPage({ searchParams }: { searchParams: Promise<{ conversation?: string | string[] }> }) {
  const session=await requireUserSession();
  if (session?.role !== 'reviewer') return <CommercialPage view="conversations"/>;
  const params = await searchParams;
  const parsed = clientSchema.shape.phone.safeParse(params.conversation);
  const initialConversation = parsed.success ? parsed.data || null : null;
  const tenantId = process.env.PIXELBOT_TENANT_ID ?? "";
  return <WhatsAppModule tenantId={tenantId} initialConversation={initialConversation} />;
}
