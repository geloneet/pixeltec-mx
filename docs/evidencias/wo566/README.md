# ¿Qué demuestra el candidato del Centro Comercial y qué falta verificar?

WO-2026-00566 · 2026-10-10 · base1aae1940 · rama codex/wo566-centro-comercial. Entorno aislado wo566.localhost:4336, PostgreSQL16 centro_qa en5454. Todo el egreso y cron del candidato están deshabilitados. Fixtures con example.invalid; abonos son registros de QA sin transferir dinero.

## Verificación automatizada

| Verificación | Resultado |
|---|---|
| npm test | 189 archivos PASS,1 omitido;2338 pruebas PASS,13 de DB omitidas por defecto |
| COMMERCIAL_DB_TESTS=1, suite comercial y auth CRM | 6 archivos,42 pruebas PASS;13 flujos ejecutados contra PostgreSQL real aislado |
| npm run typecheck | exit0, TypeScript estricto |
| npm run lint | exit0; único warning heredado img de progressive-cube |
| npm run build | exit0, Next15.5.27, generación208/208 |
| psql 0053 con ON_ERROR_STOP | PASS; aplicación repetida idempotente |
| pg_dump -Fc → pg_restore --exit-on-error | PASS en centro_qa_restore; pagos26/cotizaciones9/proyectos9/conversaciones20 iguales antes/después |
| Checklist canónico validar.mjs | PASS,4 fases/12 pasos/3 decisiones pendientes |

Comando crítico: cargar variables privadas de .env.local sin imprimirlas y ejecutar COMMERCIAL_DB_TESTS=1 NODE_OPTIONS=--no-experimental-webstorage npx vitest run src/lib/commercial src/components/crm/crm-actions.errors.test.ts src/components/crm/crm-actions.status.test.ts. La prueba rechaza DB distinta de localhost/centro_qa. Identidad y transportes se controlan en test; dinero, venta, aprovisionamiento y queries usan PostgreSQL real. SDK Resend valida firmas Svix reales con clave efímera, incluyendo cuerpo manipulado, expiración y falta de headers.

Casos: ingreso/evento repetido, hash conflictivo, identidad dudosa, envío/doble clic, fallo/reintento, política rutinaria→humano→pausa/reactivación, ventana WhatsApp24h y emisor único, edición versión vieja, aceptación protegida y venta única, parcial/anticipo/proyecto/portal, deuda pagada sin transporte, recibo adelantado/fuera de orden, saldo cambiado, pausa/reprogramación, árbol CRM antiguo/cross-owner/input inválido, reviewer/staff financiero/sin sesión y sale ajena.

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

Pendientes externos: correo y WhatsApp entrantes y salientes reales autorizados, entrega real, dominio/secretos, traspaso de bot/schedulers y gates de merge/activación. Producción no fue modificada. Historial del proyecto no representa porcentaje técnico y no cambia dinero.
