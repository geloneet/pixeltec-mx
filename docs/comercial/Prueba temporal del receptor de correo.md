# ¿Cómo se comprueba el callback real de correo sin publicar el dashboard QA?

Propuesta revisable de WO566,2026-10-12. La recuperación administrativa del correo real ya funcionó; el webhook firmado sigue pendiente. Esta propuesta requiere GO específico de Miguel para una exposición temporal y el nuevo secreto del webhook. No es autorización de activación productiva.

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

1. Verificar el SHA probado, leases/puertos propios y flags apagados. Instalar cloudflared desde el canal oficial si falta; no está disponible en PATH en este corte.
2. Guardar fuera de Git el registro privado de la prueba, proveedor, fecha, destinatario aprobado y futuro ID del webhook; no imprimir secretos. Arrancar solamente el proxy limitado y un Quick Tunnel hacia127.0.0.1:4338.
3. Registrar un webhook Resend email.received hacia la URL temporal exacta. Guardar signing_secret en0600 sin mostrarlo; cargar RESEND_WEBHOOK_SECRET únicamente en el proceso QA. COMMERCIAL_EMAIL_RECEIVING_ENABLED=true y receptor de prueba privado; egreso/cron/automatización siguen apagados.
4. Solicitar otro correo de prueba al receptor ya autorizado, con asunto y texto explicados a Miguel. Verificar firma real, intento proveedor2xx, un mensaje, contacto/oportunidad propios y replay sin duplicados. La prueba anterior ocurrió antes de existir el webhook y no se fabrica/reinyecta como si fuera un callback real.
5. Mantener el estado de identidad no verificada. Comprobar que Ajustes acredita solo el recibo firmado de esta cartera y que no hay envío automático.
6. Deshabilitar el webhook temporal, cerrar los dos procesos propios y restaurar flags. Registrar recibo saneado, documentación, conocimiento operativo y commits/push. No eliminar claves/webhooks ajenos ni modificar DNS/MX/servicios productivos.

Este GO cubre exclusivamente la recepción temporal. El recibo saliente firmado, la respuesta real nueva, el contrato wamid de PixelBot, políticas/scheduler y la activación productiva conservan sus requisitos. [Operación general](Operación%20y%20activación.md).
