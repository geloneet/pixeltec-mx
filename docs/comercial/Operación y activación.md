# ¿Cómo se activa y recupera el Centro Comercial sin duplicar mensajes o dinero?

WO-2026-00566 · 2026-10-10. Candidato en codex/wo566-centro-comercial, base 1aae1940. No está desplegado en producción. La interfaz usa PostgreSQL existente y el historial WhatsApp de PixelBot; IVA, recordPayment y aprovisionamiento por anticipo permanecen canónicos. El candidato local permite QA humana, con egress y cron deshabilitados.

## Configuración segura

Configurar en el gestor de secretos del entorno aprobado, nunca en chat, JSON del checklist, cliente, Git ni logs. La configuración del candidato no incorpora secretos productivos.

| Variable | Requisito |
|---|---|
| DATABASE_URL, AUTH_SECRET, AUTH_URL | PostgreSQL y autenticación existentes; AUTH_URL debe ser el origen HTTPS canónico para CSRF |
| COMMERCIAL_OWNER_ID | UUID de un admin activo responsable de la cartera; un tenant no se asigna a varios owners |
| PORTAL_SESSION_SECRET | Secreto del portal existente; acceso OTP y portalAccessEnabled siguen obligatorios |
| RESEND_API_KEY, RESEND_FROM_EMAIL | Permisos de envío y dominio remitente realmente verificado |
| RESEND_WEBHOOK_SECRET | Secreto Svix del endpoint /api/commercial/email-webhook; validar cuerpo crudo |
| COMMERCIAL_INBOUND_ADDRESSES | Lista de buzones receptores aprobados, separados por coma |
| COMMERCIAL_EMAIL_RECEIVING_ENABLED | true únicamente tras configurar recepción, dominio/MX y prueba firmada |
| COMMERCIAL_EMAIL_WEBHOOK_ENABLED | true permite recibos firmados de entrega sin habilitar recepción comercial |
| COMMERCIAL_REPLY_TO | Buzón aprobado para respuestas; configurar expresamente para dirigirlas al receptor comercial |
| PIXELBOT_INTERNAL_URL, PIXELBOT_INTERNAL_SECRET, PIXELBOT_TENANT_ID | Contrato interno y tenant aprobados existentes; no crear otro gateway |
| WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_API_VERSION | Meta management existente, número verificado y permisos vigentes |
| COMMERCIAL_WHATSAPP_EXCLUSIVE | true solo tras certificar que el bot anterior no responde autónomamente al tenant |
| EGRESS_EMAIL_MODE, EGRESS_WHATSAPP_MODE | Primero allowlist con destinatarios expresamente autorizados; disabled por defecto en QA |
| EGRESS_EMAIL_ALLOWLIST, EGRESS_WHATSAPP_ALLOWLIST | Correo y teléfono de prueba; nunca clientes reales por defecto |
| EGRESS_INTERNAL_MODE, EGRESS_INTERNAL_TARGET_ALLOWLIST | Acceso restringido al destino PixelBot aprobado; lecturas separadas de mensajes |
| EGRESS_INTERNAL_ALLOW_SEND_OUTSIDE_PRODUCTION | Permiso explícito requerido por guard para pruebas internas con efectos fuera de producción |
| CRON_SECRET, CRON_EXECUTION_MODE | Bearer existente; enabled solo en entorno aprobado |
| COMMERCIAL_AUTOMATION_ENABLED | Interruptor general; false durante corte y validación humana |
| COMMERCIAL_REMINDERS_ENABLED | true solo tras GO y traspaso del scheduler de la cartera |

Las conexiones se verifican desde Ajustes mediante API Resend/Meta/PixelBot, recepción firmada reciente y heartbeat de proceso. Una variable presente no prueba conexión. El asistente de WhatsApp mantiene estado pendiente hasta documentar prueba y emisor único; el flag de exclusividad es una declaración operativa, no una certificación técnica.

## Migración y candidato

1. Obtener GO de Miguel para el SHA exacto, merge y activación. No activar envíos automáticos como efecto del despliegue.
2. Operador autorizado verifica capacidad con wrapper canónico: máximo85% ocupado y mínimo20GiB libres, datos legibles. WO547 fue la última evidencia histórica; esta tarea no inspeccionó ni modificó el VPS. No eludir el guard ni borrar recursos para forzar build.
3. Pausar escrituras y emisores de la cartera durante el corte. Tomar pg_dump -Fc privado0600, registrar SHA256 sin revelar contenido y ensayar pg_restore --exit-on-error en DB aislada. Registrar conteos y ledger previos.
4. Aplicar drizzle/0053_centro_comercial.sql con psql -v ON_ERROR_STOP=1 -f. No usar db:push ni regenerar el journal: existe drift canónico en migraciones44–52. 0053 usa una transacción y backfill idempotente de quote_versions.
5. Verificar columnas/tablas/índices, conteos del núcleo y versiones. Hash SQL: 35fea9dc5045571f1c051f2cac38ccbdbbdd23753f7cc543afe17d8455899caa. QA ensayó aplicación repetida y restauración; no certifica una migración productiva ya ejecutada.
6. Desplegar solo con wrapper /usr/local/sbin/deploy-pixeltec-mx y SHA aprobado. Verificar /api/health, autenticación, siete rutas, decisión protegida, portal propio y saldo antes de habilitar cualquier emisor.

## Pruebas reales de canales y traspaso

Miguel debe indicar correo y teléfono de prueba autorizados. Mensaje propuesto: «Prueba de integración Centro Comercial PixelTEC WO566. Responde con Prueba recibida. No requiere pago ni genera compromiso». WhatsApp debe iniciarlo el destinatario autorizado para abrir la ventana vigente; no se envía texto libre fuera de24h ni se inventan plantillas aprobadas.

Verificar recepción→contacto/oportunidad→respuesta→ID de proveedor→historial persistido→recibo de entrega cuando exista. Repetir el mismo webhook sin crear otra identidad/outbox. Correo entrante se trata como identificador no verificado; coincidencias dudosas quedan sin vincular hasta revisión humana. Un evento firmado acredita al proveedor, no la identidad del remitente.

PixelBot conserva el único historial WhatsApp; el Centro guarda referencias, estado, política e intención de envío. Antes de modo humano o envío, el Centro exige confirmación PAUSED de PixelBot. La política solo responde coincidencias exactas de FAQ aprobadas: descuentos, precio, alcance, pagos, compromisos, incertidumbre e instrucciones escalan. COMMERCIAL_AUTOMATION_ENABLED no habilita una conversación: requiere política versionada, identidad resuelta y reactivación explícita.

Para programación, instalar una sola llamada cada minuto a POST /api/cron/commercial con Bearer CRON_SECRET mediante mecanismo seguro existente. No poner el secreto en crontab ni logs; usar curl --config con archivo privado0600. La ruta retorna401 sin credencial y respeta CRON_EXECUTION_MODE. El heartbeat registra ejecución completa, mientras cada canal mantiene su verificación separada.

Quiescer primero billing-charges, recurring-charges y respuestas libres anteriores para esta cartera. Con COMMERCIAL_REMINDERS_ENABLED=true, ambos cron antiguos excluyen COMMERCIAL_OWNER_ID de avisos; la materialización de cargos conserva su comportamiento financiero. Aun con flag apagado, un periodo con commercial_reminders queda excluido del cron anterior, incluso pausado, para preservar la intención. No reactivar el scheduler viejo sin conciliar recordatorios ya gestionados y outbox en curso. Paid-guard, saldo actual, fecha/periodo, revisión y outbox único se verifican antes del transporte.

## Recuperación

Outbox queued/sending/sent/delivered/failed/unknown persiste antes de red. Un timeout no demuestra fallo: unknown exige conciliación del proveedor. WhatsApp incierto nunca se reenvía automáticamente. Resend conserva idempotencia24h; el Centro solo reintenta intención incierta con la misma clave antes de23h y después de60s. Fuera de ese margen exige revisión. Recibos repetidos o anteriores no rebajan delivered a sent. Una recepción de entrega adelantada queda en cola hasta vincular ID.

Un fallo confirmado permite reintento con la misma intención; editar cuerpo no reutiliza una clave con otro hash. Un recordatorio pausado/cancelado, ya pagado o con saldo cambiado no se reenvía. Para nuevo saldo: pausar, revisar y reprogramar con revisión nueva. El envío nunca llama recordPayment. Los pagos reclaman UUID duradero y reconciliación del registro canónico, incluso tras interrupción; no repetir manualmente una operación uncertain.

Rollback de aplicación: apagar flags nuevos y quiescer emisores; usar release anterior mediante wrapper si capacidad permite. Conservar tablas/columnas aditivas y todos los registros nuevos. No ejecutar DROP ni borrar quote_versions: son evidencia. Restaurar dump productivo exige GO separado, ventana sin escrituras y conciliación de operaciones posteriores; nunca sobrescribir dinero reciente para deshacer UI.

## Límites y deuda declarada

- Sin destinatarios autorizados y secretos disponibles no hay prueba real de recepción/envío ni activación certificada. Transporte controlado de tests no equivale a proveedor conectado.
- WhatsApp sincroniza hasta1000 conversaciones y200 mensajes recientes por conversación. El historial completo sigue en PixelBot; carteras mayores necesitan paginación y control de ritmo bajo su contrato real. Una ejecución larga puede retrasar el cron, aunque claims evitan duplicar envíos.
- El CRM legado sigue reconciliando árboles completos. La protección nueva evita borrado de entidades comerciales, colisiones de owners/parents y los nuevos campos, pero la edición simultánea de la misma sección heredada sigue last-write-wins; pendiente versionar ese flujo completo.
- Reviewer mantiene su superficie restringida. Money, políticas, comprobación de proveedores y recordatorios son admin; cartera y acciones comerciales son owner-scoped para admin/staff.
- Deuda de dependencias y warning img heredado permanecen documentados; esta tarea no aplica saltos mayores ni afirma seguridad total.
- No se añadió procesador de pago en línea: se reutilizan pagos administrativos existentes. No hay evento de pasarela nuevo que contabilizar.

Contratos consultados: [firma Resend](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests), [recepción](https://resend.com/docs/api-reference/emails/retrieve-received-email), [idempotencia24h](https://resend.com/docs/dashboard/emails/idempotency-keys), [middleware Node Next15.5](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware#runtime). La compatibilidad local se comprobó con Resend6.9.4, Drizzle-Zod0.7.1 y Next15.5.27.
