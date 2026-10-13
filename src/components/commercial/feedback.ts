export const deliveryLabel: Record<string, string> = {
  received: "Recibido",
  queued: "Por enviar",
  sending: "En proceso",
  sent: "Enviado",
  delivered: "Entregado",
  failed: "Fallido",
  unknown: "Sin confirmación",
  read: "Visto",
};
const errors: Record<string, string> = {
  whatsapp_handoff_pending:
    "Confirma el traspaso de WhatsApp en Ajustes antes de enviar: el bot previo debe estar detenido y este Centro debe ser el único emisor automático.",
  EGRESS_BLOCKED:
    "La salida está deshabilitada. Revisa la conexión y los destinatarios autorizados en Ajustes.",
  egress_blocked:
    "La salida está deshabilitada. Revisa la conexión y los destinatarios autorizados en Ajustes.",
  email_egress_blocked:
    "El correo está deshabilitado. Revisa la conexión y los destinatarios autorizados en Ajustes.",
  email_provider_failed:
    "El proveedor rechazó el correo. Revisa la conexión antes de reintentar.",
  email_unknown_failure:
    "El proveedor no confirmó el resultado. Comprueba el recibo antes de repetir.",
  email_delivery_failed: "El correo no se entregó. Revisa el destinatario.",
  email_receiving_disabled:
    "La recepción de correo aún no está habilitada. Revisa la conexión en Ajustes.",
  email_receiving_addresses_not_configured:
    "Configura el buzón receptor autorizado antes de recuperar correos.",
  email_receiving_provider_failed:
    "No se pudo consultar el correo. Reintenta la revisión; los mensajes ya recuperados se conservarán sin duplicarse.",
  delivery_unconfirmed:
    "No hay un recibo confirmado. Revisa la conexión y el recibo antes de repetir.",
  whatsapp_window_closed:
    "La conversación de WhatsApp está fuera de la ventana permitida. Espera un mensaje nuevo o usa una plantilla aprobada desde WhatsApp.",
  whatsapp_original_receipt_unconfirmed:
    "WhatsApp conservó el intento, pero falta confirmar su envío. Revisa el recibo antes de repetir.",
  whatsapp_pause_not_confirmed:
    "No se confirmó la pausa del asistente. Activa atención humana y vuelve a comprobarla antes de enviar.",
  reminder_balance_changed:
    "El saldo cambió. Pausa y vuelve a preparar el recordatorio con el importe actual.",
  automatic_paused:
    "El asistente está pausado. Atiende la conversación o reactívalo explícitamente.",
  automatic_context_changed:
    "La conversación o la política cambió. Revisa el mensaje más reciente.",
  contact_review_required:
    "Confirma a qué cliente pertenece esta conversación antes de responder.",
};
export function commercialErrorLabel(value: string) {
  return errors[value] || value;
}
