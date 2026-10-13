# ¿Cómo se comprueba el callback real de correo sin publicar el dashboard QA?

Procedimiento de WO566,2026-10-12. Miguel aprobó esta prueba con «autorizo»; gate qa-email-webhook aprobado. Se abrió el receptor limitado y se comprobó su frontera, pero no llegó un correo nuevo: la firma positiva/recepción automática/replay real siguen pendientes. El webhook propio quedó deshabilitado y el túnel cerrado. No solicitar nuevamente ese GO; coordinar un correo nuevo con el receptor abierto antes de reanudar. No es autorización de activación productiva.

## Acceso preparado

| Parámetro | Valor y alcance |
|---|---|
| Origen QA | Aplicación propia en127.0.0.1:4336, PostgreSQL centro_qa5454 |
| Receptor limitado | scripts/commercial-webhook-proxy.ts,127.0.0.1:4338 |
| Única ruta pública | POST /api/commercial/webhooks/email, cuerpo≤1000000bytes |
| Transporte propuesto | Cloudflare Quick Tunnel, https://<hostname-temporal>.trycloudflare.com/api/commercial/webhooks/email |
| Suscripción Resend | Únicamente email.received |
| Destino comercial | Solo COMMERCIAL_INBOUND_ADDRESSES del receptor de prueba ya autorizado; valor privado |
| Firma | Svix real, secreto nuevo solo en archivo privado0600/configuración QA; cuerpo original y headers conservados |
| Automatización | Egreso, cron y respuestas automáticas deshabilitados |
| Finalización | Deshabilitar el webhook propio, cerrar túnel/proxy y restaurar recepción QA apagada; conservar evidencia y mensajes |

El receptor responde404 a otras rutas/métodos/queries,401 sin las cabeceras Svix y413 a cuerpos excesivos. No propaga cookies ni Authorization y devuelve únicamente un resultado booleano. El endpoint del candidato valida la firma SDK antes de tocar negocio. Metadata de otro receptor se ignora antes de consultar su cuerpo; el correo recuperado por API conserva el mismo ID/deduplicación al entrar por webhook. Un callback interrumpido queda processing y solo obtiene done tras persistencia. Un evento repetido con contenido distinto se rechaza409.

Resend suscribe eventos de la cuenta: pueden llegar metadatos de otros receptores, descartados por el filtro; sus cuerpos no se consultan. Cloudflare transportaría esos metadatos del callback y Resend seguiría siendo el proveedor. El túnel es temporal, público y destinado exclusivamente a pruebas, con hostname nuevo por sesión; no aporta disponibilidad productiva. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) y [contrato email.received](https://resend.com/docs/webhooks/emails/received).

## Ejecución tras GO

1. Verificar el SHA probado, leases/puertos propios y flags apagados. cloudflared2026.10.0 quedó instalado desde la fórmula oficial Homebrew; no se creó servicio ni arranque automático. Usar `cloudflared tunnel --no-autoupdate --metrics 127.0.0.1:0 --url http://127.0.0.1:4338` y log privado0600. No cambiar configuración de túneles existentes.
2. Guardar fuera de Git el registro privado de la prueba, proveedor, fecha, destinatario aprobado y futuro ID del webhook; no imprimir secretos. Arrancar solamente el proxy limitado y un Quick Tunnel hacia127.0.0.1:4338.
3. Recuperar primero el registro privado del webhook propio: quedó deshabilitado tras esta prueba. Verificar ID, endpoint, suscripción y estado antes de actualizar su endpoint a la nueva URL y habilitarlo; no crear otra copia ni rotar secretos a ciegas. Guardar signing_secret en0600 sin mostrarlo; cargar RESEND_WEBHOOK_SECRET únicamente en el proceso QA. COMMERCIAL_EMAIL_RECEIVING_ENABLED=true y receptor de prueba privado; egreso/cron/automatización siguen apagados.
4. Solicitar otro correo de prueba al receptor ya autorizado, con asunto y texto explicados a Miguel. Verificar firma real, intento proveedor2xx, un mensaje, contacto/oportunidad propios y replay sin duplicados. La prueba anterior ocurrió antes de existir el webhook y no se fabrica/reinyecta como si fuera un callback real.
5. Mantener el estado de identidad no verificada. Comprobar que Ajustes acredita solo el recibo firmado de esta cartera y que no hay envío automático.
6. Deshabilitar el webhook temporal, cerrar los dos procesos propios y restaurar flags. Registrar recibo saneado, documentación, conocimiento operativo y commits/push. No eliminar claves/webhooks ajenos ni modificar DNS/MX/servicios productivos.

Este GO cubre exclusivamente la recepción temporal. El recibo saliente firmado, la respuesta real nueva, el contrato wamid de PixelBot, políticas/scheduler y la activación productiva conservan sus requisitos. [Operación general](Operación%20y%20activación.md).

## Resultado del ensayo autorizado

[Recibo saneado](../evidencias/wo566/email-webhook-temporal-20261012.json): rutas ajenas/método GET404, ausencia de headers y firma inválida401; cero eventos reales del proveedor al cierre19:39CDMX. No se fabricó un evento válido ni se hizo replay. Baseline y cierre iguales:7contactos/7oportunidades/3hilos/3outbox/1correo entrante anterior. Webhook propio disabled verificado, proxy4338 y proceso del túnel cerrados; QA4336 health200 con recepción/webhook/egreso/cron apagados y sin secreto temporal en su proceso. El secreto/registro de recuperación permanecen privados0600, fuera de Git.

La inspección encontró un defecto distinto: el hilo anterior tenía contacto y una oportunidad activa existente, pero opportunityId del hilo era null. El candidato ahora enlaza la oportunidad al crear el hilo manual y repara vínculos faltantes mediante recepción/replay, con owner, bloqueo de fila y auditoría; conserva HUMAN y revisión de identidad.25casos PostgreSQL/53comerciales PASS. El hilo original no se cambió por SQL manual; su reparación real espera la próxima ingestión. La evidencia anterior de «oportunidad existente» no acreditaba ese enlace directo.

Para comprobar el replay real, usar exclusivamente el evento generado por Resend para el correo nuevo: GET /webhooks/{id}/events, detalle/attempts y POST /webhooks/{id}/events/{event_id}/replay; comprobar2xx y conteos antes/después. El SDK6.9.4 permite esas rutas mediante get/post genéricos. No reenviar mensajes ni sustituir la firma con datos sintéticos. [API oficial de webhooks](https://resend.com/changelog/headless-webhook-api).
