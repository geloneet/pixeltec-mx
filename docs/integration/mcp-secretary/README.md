# MCP comercial — candidato WO626

Este checkout añade MCP/OAuth y discovery al CRM existente. Está desactivado por defecto:503 mcp_not_active. No modifica roles ni crea credenciales, grants o tablas al importar/arrancar. La migración adjunta es candidata, no automigración.

Rutas: /api/mcp; /api/oauth/{authorize,consentimiento,consent,token,revoke,jwks,conexiones,desconectar}; /.well-known/oauth-authorization-server; /.well-known/oauth-protected-resource/api/mcp. OAuth usa SDK oficial por adaptador Fetch↔NodeHTTP sin listener adicional, sesión Auth.js real y Host exacto tras proxy. No Pages router ni cambios de UI para compatibilidad.

Configuración servidor que REQUIERE aprobación/custodio antes de introducir valores: PIXELTEC_MCP_ENABLED=true, PIXELTEC_MCP_PRIVATE_KEY_PEM (PKCS8 RSA>=2048 independiente), PIXELTEC_MCP_PUBLIC_KEY_PEM (SPKI pareja), PIXELTEC_MCP_KEY_ID, PIXELTEC_MCP_CLIENTS_JSON (un cliente público none con un redirect HTTPS exacto y scopes concretos), PIXELTEC_MCP_APPROVED_USERS_JSON (un UUID de admin/staff activo aprobado). No crear claves/clientes/grants por instalar código. Jamás pasar claves por chat o argumentos registrados. Reiniciar workers si cambia config/allowlist; revocación DB permanece por request.

PIXELTEC_MCP_SCOPES_JSON por defecto sólo ["crm:read"]. Opciones independientes de lectura: channels:email:read y channels:whatsapp:read. Cliente debe tener conjunto exacto aprobado. WhatsApp exige además PIXELTEC_MCP_TENANT_BINDINGS_JSON con mapeo aprobado del mismo usuario→tenant existente; no deducirlo de ser admin. PIXELTEC_MCP_ORIGINS_JSON es allowlist explícita opcional de origins HTTPS; vacía admite clientes servidor sin Origin, rechaza Origins de navegador. Scopes nuevos no amplían grants antiguos; refresh conserva conjunto exacto (reducción o ampliación requiere nuevo consentimiento).

Herramientas crm_list/crm_resume más email_list/email_messages y whatsapp_list/whatsapp_messages solamente si el token y grant incluyen scope canal. Email usa SQL owner-filtered y JOIN de mensajes, sin cookies, sincronización, importación ni mark-read. WhatsApp GET canónico y guard egress existente, tenant explícito y referencias opacas. Contenido libre es dato no confiable, puede contener PII; la lectura de canales incluye texto y requiere consentimiento específico. Ventanas500registros/100mensajes, no exportación completa.

Escrituras están deshabilitadas en este runtime. Adapters de seguimiento y borrador existen como candidato transaccional aparte, pero no hay herramientas/grants de escritura montados. PixelBotCAS/fence/send y notificaciones tienen paquete task7 separado, aún no integrado en este candidato de lectura. No declararlos disponibles.

0053 comercial falta en catálogo observado16oct19:02UTC; también falta mcp_secretary. No ejecutar db:migrate global: journal termina0043 y0050 es destructiva ajena. Revisar procedimiento MIGRACION-0053-REVISION de task6, catálogo/historial, backup/restauración, DDL/backfill+prechecks+recibo en una sola transacción. No envolver BEGIN/COMMIT intactos. Timeout de respuesta OAuth no cancela DB ya iniciada: recuperar por recibo y nueva autorización, no prometer rollback por desconexión HTTP.

Pruebas locales: Node20/LinuxARM64+PostgreSQL16 sintético, contratos y TypeScript; Next real MacNode26 discovery/JWKS200 y endpoint401 con claves sintéticas efímeras. No equivale a imagen productiva LinuxAMD64 ni conexión Pixeldot. No claves/grants reales.

Ruta de conexión: Plugins de cuenta ChatGPT→Add custom MCP server→https://pixeltec.mx/api/mcp→OAuth→Create as plugin→instalar→consentimiento humano→nueva conversación. ClientID y redirect se copian EXACTOS de ficha real; predefinido público none+PKCE, sin DCR/CIMD abierto. No config.toml local. No anunciar RFC9207 ni callback estable sin implementarlo. Final: tools/list y consulta real desde inventario del padre, renovación/revocación/continuidad en conversación nueva. Events2.0/webhooks no implementados; polling requeriría tarea declarada y permisos/fuente durable.

Documentos oficiales verificados16oct: https://developers.openai.com/plugins/deploy/connect-chatgpt y https://developers.openai.com/plugins/build/auth .
