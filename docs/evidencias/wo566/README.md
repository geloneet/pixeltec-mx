# ¿Qué demuestra el candidato del Centro Comercial y qué falta verificar?

WO-2026-00566 · 2026-10-10 · base1aae1940 · rama codex/wo566-centro-comercial. Entorno aislado wo566.localhost:4336, PostgreSQL16 centro_qa en5454. Todo el egreso y cron del candidato están deshabilitados. Fixtures con example.invalid; abonos son registros de QA sin transferir dinero.

## Corte vigente — callback temporal autorizado,2026-10-12 19:39

Miguel: «autorizo», gate qa-email-webhook aprobado. cloudflared2026.10.0 instalado desde Homebrew oficial sin servicio/autostart; Quick Tunnel exclusivamente al proxy local4338, un webhook email.received y secreto privado0600. [Recibo saneado](email-webhook-temporal-20261012.json):404 en otras rutas/métodos,401 sin firma/con firma inválida. Cero eventos nuevos en Resend; recepción firmada y replay positivos pendientes, sin inventarlos. Webhook propio deshabilitado y túnel/proxy cerrados; preview4336 health200, recepción/webhook/egreso/cron/automatización apagados y secreto temporal retirado del proceso. Registros privados conservados para recuperar el mismo webhook; ningún webhook ajeno, DNS, MX o producción intervenidos.

Corrección de enlace: el hilo previo tenía clientId, y existía una oportunidad activa del contacto, pero opportunityId era null. La afirmación anterior «oportunidad existente» no acreditaba vínculo directo. El candidato enlaza hilos manuales nuevos y repara el vínculo faltante mediante ingreso/replay con bloqueo/owner/auditoría, sin duplicar mensaje/actividad entrante/oportunidad ni resolver una coincidencia dudosa automáticamente. No hubo SQL manual de reparación sobre el hilo real de QA; espera próxima ingestión.

Verificación final:53pruebas comerciales PASS en6archivos,25 contra PostgreSQL real;2349generales PASS/25PG omitidos por defecto, tipos/lint/build PASS,208páginas. Warning img heredado. El primer ensayo de nuevas regresiones contaminó fixtures de la cartera compartida y fallaron2pruebas anteriores; se aislaron owners y toda la suite crítica pasó. Primer intento general dentro del sandbox terminó sin diagnóstico; repetido con2workers fuera del sandbox PASS. La limpieza inicialmente encontró el padre del proxy ya terminado después del cierre del hijo; se completó idempotentemente y se verificó puerto/proceso cerrados. [Procedimiento y siguiente prueba](../../comercial/Prueba%20temporal%20del%20receptor%20de%20correo.md).

## Verificación automatizada

| Verificación | Resultado |
|---|---|
| npm test | Revisión 21:10: 189 archivos PASS,1 omitido;2338 pruebas PASS,14 de DB omitidas por defecto |
| COMMERCIAL_DB_TESTS=1, suite comercial y auth CRM | Revisión de idempotencia: 6 archivos,43 pruebas PASS;14 flujos ejecutados contra PostgreSQL real aislado |
| npm run typecheck | exit0, TypeScript estricto |
| npm run lint | exit0; único warning heredado img de progressive-cube |
| npm run build | exit0, Next15.5.27, generación208/208 |
| psql 0053 con ON_ERROR_STOP | PASS; aplicación repetida idempotente |
| pg_dump -Fc → pg_restore --exit-on-error | PASS en centro_qa_restore; pagos26/cotizaciones9/proyectos9/conversaciones20 iguales antes/después |
| Checklist canónico validar.mjs | PASS,4 fases/12 pasos/3 decisiones pendientes |

Comando crítico: cargar variables privadas de .env.local sin imprimirlas y ejecutar COMMERCIAL_DB_TESTS=1 NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/lib/commercial src/components/crm/crm-actions.errors.test.ts src/components/crm/crm-actions.status.test.ts. La prueba rechaza DB distinta de localhost/centro_qa. Identidad y transportes se controlan en test; dinero, venta, aprovisionamiento y queries usan PostgreSQL real. SDK Resend valida firmas Svix reales con clave efímera, incluyendo cuerpo manipulado, expiración y falta de headers.

Casos: ingreso/evento repetido, hash conflictivo, identidad dudosa, envío/doble clic, fallo/reintento, política rutinaria→humano→pausa/reactivación, ventana WhatsApp24h y emisor único, edición versión vieja, aceptación protegida y venta única, parcial/anticipo/proyecto/portal, deuda pagada sin transporte, recibo adelantado/fuera de orden, saldo cambiado, pausa/reprogramación, árbol CRM antiguo/cross-owner/input inválido, reviewer/staff financiero/sin sesión y sale ajena.

Revisión 2026-10-10, 21:09: compartir un avance reutilizaba el outbox, pero añadía una actividad por petición repetida. Una regresión PostgreSQL reprodujo cuatro actividades para un solo envío (13 PASS/1 FAIL). La corrección identifica la actividad con el UUID duradero del outbox y hace el insert idempotente. La misma secuencia —dos peticiones sucesivas y dos concurrentes— ahora deja un envío y una actividad; una cartera ajena se rechaza. Suite crítica: 43 PASS, incluidos 14 flujos de DB; suite general, tipos, lint y build repetidos PASS. No requiere otra migración y no elimina actividades anteriores.

## Evidencia en navegador

CUA sobre el candidato compilado; acciones humanas reales contra API y PostgreSQL QA, sin mocks de interfaz. Las capturas muestran fixtures y no acreditan integración externa.

- inicio-oscuro.jpg: prioridades propias y siguiente paso persistido al recargar.
- contacto-ficha-persistida.jpg: contacto creado desde Clientes y ficha abierta sin recarga manual; identidad consistente.
- proyecto-actualizado.jpg: etapa Listo para revisar, nota, próxima fecha e historial guardados.
- cobro-parcial-doble-click.jpg: $400 previo+$50 una sola vez, saldo $710 de $1160, dos registros.
- conversacion-envio-bloqueado.jpg: outbox de envío confirmado por humano conserva fallo, sin mensaje externo.
- cotizacion-decision-cliente.jpg: aceptación versión1 con nombre declarado y comentario QA; doble clic y recarga conservan una sola decisión.
- proyecto-unico-por-anticipo.jpg: confirmación administrativa doble clic genera una venta/dos cargos; anticipo sintético $580 doble clic aprovisiona un proyecto; proyecto previo de otro cliente conservado.
- portal-cliente-qa.jpg: acceso OTP canónico efímero de prueba muestra únicamente proyecto, etapa, nota y próximo paso propios.
- archivos *-movil-claro.jpg y responsive.json: las siete pantallas a390px; también medidas de todas a320px, scrollWidth igual al viewport y desplazamiento inicial0.
- modal-320-teclado.jpg: foco inicial, Escape, retorno a Nuevo contacto y reapertura a320px. Menú móvil usa inert, ciclo de foco y Escape con retorno al botón.
- ajustes-claro.jpg y conexiones-pendientes.jpg: tema claro/oscuro, política QA persistida sin automatización; requisitos exactos de canales y proceso. Movimiento reducido medido0s; normal130ms.

Los conteos del respaldo corresponden al ensayo anterior al flujo de cotización del navegador; las acciones posteriores agregaron registros sintéticos, sin cambiar la comparación del snapshot restaurado. Las capturas finales desactivan animación mediante la preferencia de QA para mostrar superficies estables; los tiempos normales se midieron por separado.

Adaptación móvil: navegación en menú accesible reutilizando la estructura del producto, en vez de importar la barra demo. Se conservan las siete entradas y la composición del contenido. Los controles «Pagar en línea» y «Error de demo» del ZIP no se presentan como capacidades existentes: el producto reutiliza registro administrativo y errores/recibos reales.

## Comprobación autorizada de Resend — 2026-10-11

Miguel respondió «autorizo» a usar la configuración de /Users/pixeltec/Desktop/PixelTECDEV/pixeltec-os/.env.local únicamente para comprobar el dominio remitente. Dos consultas GET /domains (con limit 100 y con parámetros predeterminados) retornaron validation_error; clasificación saneada de la segunda: invalid_api_key, a las 2026-10-12T00:21:26.904Z. No se imprimió respuesta cruda, clave ni valor del archivo; cero envíos y sin copiar credenciales al candidato.

Miguel inició sesión en Resend y avisó «ready». CUA comprobó la fila exacta pixeltec.mx en https://resend.com/domains: estado Verified. La captura permanece privada/local; la revisión automática rechazó publicarla en GitHub por incluir información de cuenta y otros dominios. Este registro publica solo el resultado saneado del dominio objetivo. El dominio queda verificado desde el panel real; la clave del checkout anterior fue rechazada y requiere una credencial válida/configuración segura para conectar el candidato por API. No se crearon claves, ampliaron permisos ni alteraron DNS. Esta evidencia no acredita recepción, entrega ni envío desde el candidato.

## Reutilización autorizada del env del VPS — 2026-10-11

Miguel indicó expresamente usar las claves del env de la aplicación actual del VPS: «TOMALAS DE AHI». Se leyó /home/ubuntu/pixeltec-mx/.env.production (0600) y se contrastaron las variables necesarias con el contenedor pixeltec-mx activo: coincidencia exacta comprobada en memoria, sin imprimir valores. GET /domains desde VPS devolvió pixeltec.mx verified, sending enabled, receiving disabled. Se importaron únicamente las variables necesarias de Resend, WhatsApp y PixelBot al .env.local ignorado/privado0600 del candidato; se preservaron DATABASE_URL y AUTH_SECRET de QA. No se copiaron DB, identidad ni política live del VPS.

La segunda comprobación con Resend6.9.4 desde la Mac pasó a las2026-10-12T00:43:15.208Z. [Recibo saneado](conexiones-vps-20261011.json): API/remitente verificados, egreso email/WhatsApp/interno y cron disabled; automatización, recordatorios y recepción/webhook false. Contrato E0 perfil dev PASS con node -r dotenv/config --import tsx scripts/validate-egress-config.ts, DOTENV_CONFIG_PATH=.env.local; preview reiniciado únicamente en4336, /api/health HTTP200. Sin cambios de código/schema ni nueva migración; comprobaciones enfocadas en configuración. No se ejecutó otra batería completa porque no cambió el código.

Verificación de Ajustes pendiente en este corte: la política de seguridad del navegador rechazó seleccionar la pestaña de error anterior; no se intentó evadir ese bloqueo. La comprobación API desde Mac y la salud del servidor sí quedaron verificadas. No se crearon ni rotaron claves, cambiaron permisos/DNS, enviaron mensajes, leyeron conversaciones productivas ni modificaron servicios del VPS. Capturas autenticadas del proveedor permanecen privadas y no forman parte del commit.

Pendientes al corte2026-10-11: pruebas reales autorizadas de correo/WhatsApp, entrega y recepción, RESEND_WEBHOOK_SECRET, buzón comercial/reply-to/MX, traspaso de bot/schedulers y gates de merge/activación. El corte siguiente resuelve los destinatarios, el envío y las comprobaciones descritas abajo. La clave remitente válida ya está disponible y comprobada. Producción no fue modificada. Historial del proyecto no representa porcentaje técnico y no cambia dinero.

## WhatsApp real dirigido — 2026-10-12

Miguel proporcionó su número para esta prueba y confirmó haber enviado el mensaje inicial y respondido «Prueba recibida». El destinatario completo, secretos, cookies, cuerpos históricos e IDs privados permanecen fuera de Git. Preflight: conversación antigua fuera de ventana; Meta status CONNECTED con code_verification_status EXPIRED. La regresión PostgreSQL reprodujo el falso desconectado (14 PASS/1 FAIL); se separó el estado de conexión del código. La sincronización dirigida usa schema Drizzle-Zod, tenant/owner existente y solo el destinatario solicitado; replay no importa duplicados y otra cartera se rechaza.

El cliente real de autenticación QA inició sesión y llamó las APIs compiladas del candidato. A las16:27:37Z llegó el mensaje inicial; creó un contacto, una oportunidad y una conversación. Atención humana confirmó PAUSED de esa conversación en PixelBot. Primer intento bloqueado definitivamente por allowlist sin el prefijo E.164; cero mensajes en proveedor. Se corrigió únicamente la configuración privada y se reintentó el mismo outbox con su UUID duradero. Hubo una copia saliente a las16:40:33Z; repetir la petición conservó un outbox/una copia. La respuesta entrante de Miguel llegó16:41:08Z y se sincronizó; último replay importó0. [Recibo saneado](whatsapp-real-20261012.json): un contacto, una oportunidad, un outbox, dos claims locales (el primero bloqueado antes de transporte), una copia externa y respuesta recibida.

La respuesta manual requiere HUMAN, ventana, allowlist y PAUSED confirmado; el gate de emisor único del tenant se mantiene para automatización. Regresión adicional: pausa no confirmada impide transporte; respuesta automática con tenant no exclusivo queda bloqueada. No se activaron otras conversaciones, automatización general, dinero, DNS, credenciales nuevas, migraciones o deploy. Sin cambio de schema de DB; schemas.ts solo añade validación derivada de un filtro de API.

Pruebas del cambio:178 críticas PASS en8 archivos, incluidos16 casos PostgreSQL;2338 generales PASS con16 DB omitidos por defecto, tipos/lint/build PASS (warning img heredado). El build final incluye el rechazo de pausa accionable. No se repitió la suite general tras ese texto aislado; los cambios de lógica sí están cubiertos por ambos cortes. La verificación visual de este corte permanece pendiente por el bloqueo previo del navegador; la prueba real usó las APIs y autenticación del candidato, sin simular transportes.

Límite comprobado: /internal/send vigente devuelve status/phone, sin wamid Meta; waMessageId del historial es el UUID de intención y deliveryStatus sigue null. La respuesta humana verifica ida/vuelta, pero no un recibo automático delivered/read. No se modificó PixelBot para eludir ese contrato: requiere integración coordinada de su recibo. Final de la prueba: túnel propio cerrado y egreso email/WhatsApp/interno y cron disabled; conversación real de prueba sigue en atención humana/PAUSED. La autorización y prueba de correo se completaron después, según el siguiente apartado; automatización, recibos completos y gates productivos permanecen pendientes.

## Correo saliente real y capacidad — 2026-10-12

Miguel indicó un correo de su dominio como destinatario de la prueba explicada en el chat. Allowlist privada de un destinatario, sin publicar dirección, cookies o ID del email. DMARC confirmado y MX principal Cloudflare Email Routing. Reply-to toma el buzón de equipo existente del VPS; no crea un buzón nuevo ni mueve su recepción. El candidato autenticó QA, creó contacto/conversación, envió el mensaje autorizado y repitió la petición con la misma intención: un outbox, una tentativa, un mensaje persistido y mismo ID de proveedor. A las16:54:39Z, Resend queued; a las16:55:19Z, GET del ID exacto confirmó delivered. [Recibo saneado](email-real-20261012.json). No acredita lectura humana ni recepción entrante en el Centro.

RESEND_WEBHOOK_SECRET y la recepción siguen pendientes. Sin callback firmado la UI conserva sent; la entrega se verificó externamente por API, sin fabricar un evento Svix. Recepción preparada para mantener los MX existentes: prueba en subdominio administrado de Resend, o subdominio comercial dedicado con MX/reenvío y webhook aprobados. No se cambió DNS, routing, permisos, dominios o infraestructura. El navegador anterior estaba desconectado; se recuperó el mismo proveedor de esta conversación mediante su API documentada. El panel Receiving mostró la dirección administrada de la cuenta y No received emails yet; dirección completa privada, sin creación ni cambio de configuración. No se inspeccionaron estado oculto/cookies ni se eludió el bloqueo previo del preview.

La prueba de email terminó con todos los emisores y cron disabled; preview final healthHTTP200 y contrato E0 dev PASS. Readonly de capacidad del VPS:88%,13083316KiB libres (~12.48GiB), aplicación running/restarts0. El gate de capacidad85%/20GiB no se satisface. Ninguna limpieza, migración, reinicio o despliegue productivo realizado; requiere revisión de recursos y confirmación humana. WhatsApp ida/vuelta y email entregado están comprobados; recibos automáticos completos, recepción, política/scheduler/emisor único y activación siguen pendientes.


## Capacidad recuperada por limpieza autorizada — 2026-10-12

Miguel pidió «haz una limpieza del vps para que existan los 20 gib libres»; alcance y gate destructive-op registrados antes de mutar. [Recibo saneado](vps-capacidad-20261012.json):12.456→20.316GiB libres,88→79%,7.859GiB recuperados. Se retiraron dos imágenes antiguas propias y ocho imágenes públicas de herramientas sin contenedor y con digest disponible en el registro, caché Docker sin uso>24h y siete cachés descargables sin ejecutable activo. El script canónico conserva dos SHA recientes, que incluyen activa68c0bbae y previa9e7320b, más tags protegidos; no es una regla de tres imágenes adicionales. Ambos commits retirados siguen disponibles en Git.

HostLock nativo648 en dry-run,649/650 en aplicación; flock de cache. La primera pasada se detuvo ante discrepancia inmediata del inventario después de cuatro retiros; lecturas posteriores coincidieron con el baseline original. Se reanudó desde el recibo sin repetir acciones. No se estableció la causa de esa discrepancia ni se inventa un incidente de servicio. Comparación final:38contenedores/34running,27volúmenes y5procesosPM2 con los mismos IDs/imágenes/estados/reinicios; todas las imágenes ajenas al plan conservadas. Homepage/APIhealth200 y frontera Intranet401 esperada. Sin SQL de negocio, migraciones, reinicios, deploy, DNS/cron o política recurrente nuevos.

Workspace temporal propio eliminado; recibo privado600 conservado en prune-logs por30d, copia local con SHA256 igual. Lock nativo liberado. La limpieza satisface el margen medido; antes de otro deploy hay que medirlo de nuevo. Candidato del dashboard y gates merge/activación siguen pendientes. Sin código de producto cambiado ni otra batería de compilación: validación de esta tarea son snapshots, comandos y HTTP reales. La guía Docker tenía una referencia histórica incorrecta a purga global; conciliada en NeuroPIXEL sin reescribir DISK-001 ni cambiar Custodio.

## Recepción real y recuperación —2026-10-12 19:00

Miguel confirmó que envió el correo al receptor nativo aislado. GET receiving.list encontró una coincidencia de asunto/destino, remitente autorizado. API autenticada del candidato importó1; replay0 y replays posteriores0. Una conversación/contacto/oportunidad, un mensaje recibido persistente y cuerpo igual al proveedor. El proveedor devolvió contenido sin texto útil: la UI muestra [Correo sin texto], no se inventa el cuerpo solicitado. Identidad no verificada, HUMAN, cero envíos automáticos y cero prueba de callback firmado. [Recibo saneado](email-entrada-real-20261012.json).

Recuperación administrativa nueva: sync_email, solo admin/owner/receptores configurados, una página≤100 y cursor. No obtiene cuerpos de otros buzones y no activa respuestas. API y webhook deduplican por providerID/owner; firma/destino se verifican antes del cuerpo, hash conflictivo409 y recibo processing→done recuperable. Estado verificado en Ajustes requiere recibo firmado de esta cartera y configuración vigente. Resend429 respeta Retry-After con≤3intentos y≤5s de espera por intento; rechazos permanentes no se repiten ni imprimen body.

50 críticas PASS en6archivos,22casos PostgreSQL real;2349 generales PASS/22PG omitidos por defecto;tipos/lint/build PASS tras corrección de dos incompatibilidades de tipos del SDK y Node, sin cast/relajar strict. QA Docker Desktop estaba detenido y se restauraron motor/contenedor propio; primer ensayo DB falló ECONNREFUSED y no se presenta como PASS. Sin cambio de schema/migración nuevo. Producción no fue alterada.

Navegador IAB volvió a estar disponible al restaurar el servidor local y abrir la ruta HTTP permitida; no se evadió el protocolo de la pestaña de error anterior. Sesión QA existente, bandeja muestra mensaje real y botón Recibir correos/replay0. [Captura del control sin datos de contacto](recuperacion-correo-control.png); captura completa privada. Veredicto visual de este control PASS a320 y1440px: scrollWidth igual al viewport y botones visibles/acomodados, tamaño temporal restablecido. No se repite aquí toda la batería de las siete pantallas ya registrada.

Receptor temporal preparado con5pruebas de frontera: soloPOST/ruta exacta, sin cookies/Authorization ni respuesta privada, bytes/Svix intactos, límite1MB y rechazo conservado. [Propuesta revisable](../../comercial/Prueba%20temporal%20del%20receptor%20de%20correo.md). No hay túnel/webhook/secreto nuevo público todavía.

Medición posterior de VPS:19989904KiB libres=19.064GiB,81%. La limpieza anterior logró20.316GiB al corte; el almacenamiento volvió a crecer y la causa no está establecida. Docker ahora declara1.38GB de caché recuperable sin acreditar antigüedad/exclusividad. No se repite limpieza ni se toca cache activo; margen≥20GiB vuelve a ser dependencia del despliegue.
