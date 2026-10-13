# ¿Cómo se activa y recupera el Centro Comercial sin duplicar mensajes o dinero?

WO-2026-00566 · 2026-10-10. Candidato en codex/wo566-centro-comercial, base 1aae1940. No está desplegado en producción. La interfaz usa PostgreSQL existente y el historial WhatsApp de PixelBot; IVA, recordPayment y aprovisionamiento por anticipo permanecen canónicos. El candidato local permite QA humana, con egress y cron deshabilitados.

Estado2026-10-12: correo firmado real recibido y entregado por el dashboard, replayHTTP200 sin duplicados y vínculo antiguo de oportunidad reparado por sync autenticado. [Recibo real](../evidencias/wo566/email-firmado-real-20261012.json). Webhook propio disabled, túnel/proxy cerrados y secreto temporal retirado; QAegreso/cronoff. Identidad del remitente no verificada.

WhatsApp incorpora recibo nativo y conciliación propia, coordinados con [PixelBot PR7](https://github.com/geloneet/pixelbot/pull/7), bbebf4d. Unir por owner/conversación/intención/cuerpo/actor; read refleja delivered en outbox y conserva read en el historial único de PixelBot. Los terminales no retroceden y los replays no crean envíos ni mensajes. ACK nuevo incompleto queda unknown; legacy sent sin wamid no acredita entrega. Sus gates históricos no conceden activación del dashboard. Prueba final WhatsApp autorizada espera activar ese servicio conservando config/prompts.yaml local y mounts originales.


Capacidad fresh20.178GiB/80%, operación limitada autorizada yrecursos preservados; [recibo](../evidencias/wo566/vps-capacidad-refresh-20261012.json). Medir de nuevo antes de build/deploy; no repetir purgas con este permiso ya utilizado.

## Configuración segura

Configurar en el gestor de secretos del entorno aprobado, nunca en chat, JSON del checklist, cliente, Git ni logs. El 2026-10-11 Miguel autorizó reutilizar las credenciales del env del VPS: las variables necesarias de Resend, Meta y PixelBot están en .env.local privado/ignorado0600 del candidato. DB y autenticación conservan sus valores de QA; egreso, cron y automatización permanecen apagados. Ningún secreto forma parte del artefacto versionado.

| Variable | Requisito |
|---|---|
| DATABASE_URL, AUTH_SECRET, AUTH_URL | PostgreSQL y autenticación existentes; AUTH_URL debe ser el origen HTTPS canónico para CSRF |
| COMMERCIAL_OWNER_ID | UUID de un admin activo responsable de la cartera; un tenant no se asigna a varios owners |
| PORTAL_SESSION_SECRET | Secreto del portal existente; acceso OTP y portalAccessEnabled siguen obligatorios |
| RESEND_API_KEY, RESEND_FROM_EMAIL | Permisos de envío y dominio remitente realmente verificado |
| RESEND_WEBHOOK_SECRET | Secreto Svix del endpoint /api/commercial/webhooks/email; validar cuerpo crudo |
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

Meta distingue status del número y code_verification_status del código. Se comprueba connectionStatus=CONNECTED junto al historial autenticado de PixelBot; un código EXPIRED no acredita desconexión. Una respuesta humana exige modo HUMAN, ventana vigente, allowlist E.164 exacta y confirmación PAUSED de esa conversación antes de cada envío. Las respuestas automáticas conservan el requisito adicional COMMERCIAL_WHATSAPP_EXCLUSIVE=true para el tenant. Una pausa no confirmada rechaza el envío con error accionable; no se necesita detener otras conversaciones para responder manualmente a una prueba autorizada.

POST /api/commercial action=sync_whatsapp acepta data.address opcional, validado mediante schema derivado de commercialConversations. Sirve para importar únicamente la conversación autorizada del tenant propio; no permite cambiar tenant/owner. Sin filtro mantiene la sincronización de cartera existente. Prueba real2026-10-12: ingreso→contacto/oportunidad→atención humana→envío→respuesta, una copia y un outbox al repetir la petición. [Recibo saneado](../evidencias/wo566/whatsapp-real-20261012.json). Se cerró el túnel SSH temporal y se restauró egreso/cron disabled; el chat de prueba real permanece PAUSED en PixelBot hasta reactivación humana explícita.

Comprobación del 2026-10-11: Resend GET /domains respondió desde VPS y Mac; pixeltec.mx verified, sending enabled, receiving disabled. Las credenciales del archivo /home/ubuntu/pixeltec-mx/.env.production coinciden con el contenedor activo. La falta de una clave remitente válida quedó resuelta. En ese corte quedaban pendientes webhook, buzón y pruebas reales; las pruebas y el reply-to del equipo se resolvieron parcialmente el2026-10-12 como se describe a continuación. Recepción y RESEND_WEBHOOK_SECRET siguen pendientes. [Recibo saneado](../evidencias/wo566/conexiones-vps-20261011.json).

Corte2026-10-12: correo de prueba autorizado enviado mediante la API autenticada del candidato, un outbox/un mensaje/una tentativa de transporte y replay sin duplicado. Resend GET del ID persistido confirmó last_event=delivered; [recibo saneado](../evidencias/wo566/email-real-20261012.json). Reply-to usa el buzón de equipo existente del VPS. El callback firmado aún no está configurado: la interfaz conserva sent, mientras esta comprobación externa acredita entrega del proveedor; no insertar un webhook ficticio ni marcar recepción verificada.

DNS público2026-10-12: DMARC presente y MX del dominio principal en Cloudflare Email Routing. Recepción nueva debe conservar esos MX y sus reglas. Para una prueba aislada, Resend dispone de un subdominio administrado de la cuenta; para dirección comercial propia, usar un subdominio dedicado con MX y webhook firmados antes de cambiar reply-to o establecer un reenvío aprobado. [Guía oficial de recepción](https://resend.com/docs/dashboard/receiving/introduction) y [convivencia con MX existentes](https://resend.com/docs/dashboard/receiving/custom-domains). Este diseño está preparado; no se crearon dominios/webhooks, nuevas credenciales, reenvíos, DNS o accesos públicos.

## Migración y candidato

1. Obtener GO de Miguel para el SHA exacto, merge y activación. No activar envíos automáticos como efecto del despliegue.
2. Operador autorizado verifica capacidad con wrapper canónico: máximo85% ocupado y mínimo20GiB libres, datos legibles. El2026-10-12 Miguel autorizó limpieza:12.456→20.316GiB y88→79%, servicios/datos/rollback preservados; [recibo](../evidencias/wo566/vps-capacidad-20261012.json). Se conservaron activa68c0bbae y previa9e7320b conforme a las dos SHA recientes del script, y todos los tags protegidos. El margen ya se cumple en ese corte; volver a medir antes de desplegar, sin eludir el guard. Limpieza puntual sin cambios de política/cron, no autorización de merge o deploy.
3. Pausar escrituras y emisores de la cartera durante el corte. Tomar pg_dump -Fc privado0600, registrar SHA256 sin revelar contenido y ensayar pg_restore --exit-on-error en DB aislada. Registrar conteos y ledger previos.
4. Aplicar drizzle/0053_centro_comercial.sql con psql -v ON_ERROR_STOP=1 -f. No usar db:push ni regenerar el journal: existe drift canónico en migraciones44–52. 0053 usa una transacción y backfill idempotente de quote_versions.
5. Verificar columnas/tablas/índices, conteos del núcleo y versiones. Hash SQL: 35fea9dc5045571f1c051f2cac38ccbdbbdd23753f7cc543afe17d8455899caa. QA ensayó aplicación repetida y restauración; no certifica una migración productiva ya ejecutada.
6. Desplegar solo con wrapper /usr/local/sbin/deploy-pixeltec-mx y SHA aprobado. Verificar /api/health, autenticación, siete rutas, decisión protegida, portal propio y saldo antes de habilitar cualquier emisor.

## Pruebas reales de canales y traspaso

Miguel autorizó correo y teléfono de prueba el2026-10-12; sus valores permanecen privados. Cualquier destinatario nuevo requiere autorización específica. Mensaje de prueba sin compromiso/pago, con respuesta solicitada únicamente para WhatsApp. WhatsApp debe iniciarlo el destinatario autorizado para abrir la ventana vigente; no se envía texto libre fuera de24h ni se inventan plantillas aprobadas.

Verificar recepción→contacto/oportunidad→respuesta→ID de proveedor→historial persistido→recibo de entrega cuando exista. Repetir el mismo webhook sin crear otra identidad/outbox. Correo entrante se trata como identificador no verificado; coincidencias dudosas quedan sin vincular hasta revisión humana. Un evento firmado acredita al proveedor, no la identidad del remitente.

PixelBot conserva el único historial WhatsApp; el Centro guarda referencias, estado, política e intención de envío. Antes de modo humano o envío, el Centro exige confirmación PAUSED de PixelBot. La política solo responde coincidencias exactas de FAQ aprobadas: descuentos, precio, alcance, pagos, compromisos, incertidumbre e instrucciones escalan. COMMERCIAL_AUTOMATION_ENABLED no habilita una conversación: requiere política versionada, identidad resuelta y reactivación explícita.

Para programación, instalar una sola llamada cada minuto a POST /api/cron/commercial con Bearer CRON_SECRET mediante mecanismo seguro existente. No poner el secreto en crontab ni logs; usar curl --config con archivo privado0600. La ruta retorna401 sin credencial y respeta CRON_EXECUTION_MODE. El heartbeat registra ejecución completa, mientras cada canal mantiene su verificación separada.

Quiescer primero billing-charges, recurring-charges y respuestas libres anteriores para esta cartera. Con COMMERCIAL_REMINDERS_ENABLED=true, ambos cron antiguos excluyen COMMERCIAL_OWNER_ID de avisos; la materialización de cargos conserva su comportamiento financiero. Aun con flag apagado, un periodo con commercial_reminders queda excluido del cron anterior, incluso pausado, para preservar la intención. No reactivar el scheduler viejo sin conciliar recordatorios ya gestionados y outbox en curso. Paid-guard, saldo actual, fecha/periodo, revisión y outbox único se verifican antes del transporte.

## Recuperación

Outbox queued/sending/sent/delivered/failed/unknown persiste antes de red. Un timeout no demuestra fallo: unknown exige conciliación del proveedor. WhatsApp incierto nunca se reenvía automáticamente. Resend conserva idempotencia24h; el Centro solo reintenta intención incierta con la misma clave antes de23h y después de60s. Fuera de ese margen exige revisión. Recibos repetidos o anteriores no rebajan delivered a sent. Una recepción de entrega adelantada queda en cola hasta vincular ID.

Un fallo confirmado permite reintento con la misma intención; editar cuerpo no reutiliza una clave con otro hash. Un recordatorio pausado/cancelado, ya pagado o con saldo cambiado no se reenvía. Para nuevo saldo: pausar, revisar y reprogramar con revisión nueva. El envío nunca llama recordPayment. Los pagos reclaman UUID duradero y reconciliación del registro canónico, incluso tras interrupción; no repetir manualmente una operación uncertain.

Compartir un avance registra una sola actividad por outbox confirmado: el UUID del envío también identifica su recibo de actividad. Si se pierde la respuesta HTTP después del envío y el avance conserva su revisión, repetir la misma petición conserva el mensaje y repara el registro faltante; no añade otra entrada al historial. Esta corrección no borra ni consolida historia anterior.

Rollback de aplicación: apagar flags nuevos y quiescer emisores; usar release anterior mediante wrapper si capacidad permite. Conservar tablas/columnas aditivas y todos los registros nuevos. No ejecutar DROP ni borrar quote_versions: son evidencia. Restaurar dump productivo exige GO separado, ventana sin escrituras y conciliación de operaciones posteriores; nunca sobrescribir dinero reciente para deshacer UI.

## Límites y deuda declarada

- Sin destinatarios autorizados y secretos disponibles no hay prueba real de recepción/envío ni activación certificada. Transporte controlado de tests no equivale a proveedor conectado.
- PixelBot productivo aún tiene el contrato legacy sin recibo manual correlacionable. Candidato y consumidor probados, sin deploy; la nueva prueba final autorizada espera el servicio corregido. No afirmar delivered ni reenviar incertidumbre.
- WhatsApp sincroniza hasta1000 conversaciones y200 mensajes recientes por conversación. El historial completo sigue en PixelBot; carteras mayores necesitan paginación y control de ritmo bajo su contrato real. Una ejecución larga puede retrasar el cron, aunque claims evitan duplicar envíos.
- El CRM legado sigue reconciliando árboles completos. La protección nueva evita borrado de entidades comerciales, colisiones de owners/parents y los nuevos campos, pero la edición simultánea de la misma sección heredada sigue last-write-wins; pendiente versionar ese flujo completo.
- Reviewer mantiene su superficie restringida. Money, políticas, comprobación de proveedores y recordatorios son admin; cartera y acciones comerciales son owner-scoped para admin/staff.
- Deuda de dependencias y warning img heredado permanecen documentados; esta tarea no aplica saltos mayores ni afirma seguridad total.
- No se añadió procesador de pago en línea: se reutilizan pagos administrativos existentes. No hay evento de pasarela nuevo que contabilizar.

Contratos consultados: [firma Resend](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests), [recepción](https://resend.com/docs/api-reference/emails/retrieve-received-email), [idempotencia24h](https://resend.com/docs/dashboard/emails/idempotency-keys), [middleware Node Next15.5](https://nextjs.org/docs/15/app/api-reference/file-conventions/middleware#runtime). La compatibilidad local se comprobó con Resend6.9.4, Drizzle-Zod0.7.1 y Next15.5.27.

## Recuperación administrativa y callback temporal —2026-10-12 19:00

POST /api/commercial action=sync_email, data={} o {after:UUID}, es admin y cartera configurada. Consulta una página de100 metadatos y solo obtiene cuerpos de receptores autorizados; cursor continúa historia anterior. Recibir correos en Conversaciones muestra número nuevo/fin/página siguiente. El pull no ejecuta respuestas aprobadas ni fabrica un recibo Svix; el callback conserva la misma deduplicación. Firma real del endpoint, filtro de receptor antes de obtener cuerpo, recibo processing/done y hash conflictivo409 son requisitos separados. Metadata del proveedor se valida con campos derivados de las tablas. Repetir o recuperarse de un fallo parcial conserva una sola copia. Resend429 espera Retry-After dentro de3intentos/≤5s por espera y falla saneado fuera del presupuesto.

Prueba real: ingreso del receptor nativo autorizado→conversación/contacto/oportunidad e historial existente,1mensaje/replay0, HUMAN e identificador no verificado. Correo sin texto útil representado honestamente; ningún envío nuevo. [Evidencia](../evidencias/wo566/email-entrada-real-20261012.json).

El receptor limitado [preparado para aprobación](Prueba%20temporal%20del%20receptor%20de%20correo.md) admite soloPOST en /api/commercial/webhooks/email y omite cookies/Authorization/respuestas privadas. Una eventual URL Cloudflare temporal transmite únicamente el callback; Resendemail.received y un secreto Svix nuevo requieren GO antes de abrirlo. No se instaló cloudflared ni se creó/publicó un endpoint. Recepción por pull está probada; callback automático y recibo de entrega firmado siguen pendientes.

Fresh df posterior:19.064GiB libres/81%, frente a20.316GiB/79% al cerrar la limpieza. Causa del crecimiento no establecida; el guard20GiB debe cumplirse otra vez antes del deploy. El permiso de limpieza anterior no se amplía automáticamente.
