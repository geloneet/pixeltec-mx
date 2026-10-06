import { Mail } from "lucide-react";
import { SiWhatsapp } from "@icons-pack/react-simple-icons";
import type { Channel, PriorityStatus, Tone } from "@/lib/hoy/types";
import { cn } from "@/lib/utils";
import { TONE_CHIP } from "./tones";

export function ToneChip({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium", TONE_CHIP[tone], className)}>
      {children}
    </span>
  );
}

const STATUS: Record<PriorityStatus, { label: string; tone: Tone }> = {
  cotizacion_enviada: { label: "Cotización enviada", tone: "blue" },
  seguimiento: { label: "Seguimiento", tone: "violet" },
  pago_pendiente: { label: "Pago pendiente", tone: "orange" },
  pago_vencido: { label: "Pago vencido", tone: "red" },
};

export function StatusChip({ status }: { status: PriorityStatus }) {
  const s = STATUS[status];
  return <ToneChip tone={s.tone}>{s.label}</ToneChip>;
}

export function ChannelChip({ channel }: { channel: Channel }) {
  if (channel === "whatsapp") {
    return (
      <ToneChip tone="emerald" className="gap-1 px-1.5 text-[11px]">
        <SiWhatsapp className="h-3 w-3" title="" aria-hidden />
        WhatsApp
      </ToneChip>
    );
  }
  return (
    <ToneChip tone="blue" className="gap-1 px-1.5 text-[11px]">
      <Mail className="h-3 w-3" aria-hidden />
      Correo
    </ToneChip>
  );
}
