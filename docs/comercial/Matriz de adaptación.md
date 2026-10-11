# ¿Qué falta para operar el Centro Comercial sobre el CRM existente?

WO-2026-00566, 2026-10-10. Base efectiva 1aae1940; rama codex/wo566-centro-comercial. El ZIP es referencia de diseño e interacción; sus datos temporales no se incorporan al producto.

| Función | Capacidad existente | Adaptación | Aceptación |
|---|---|---|---|
| Inicio | Snapshot owner-scoped, prioridades | Hero y filas del diseño con acciones persistentes | Recarga conserva siguiente acción y contadores |
| Ventas | Cotizaciones, ventas y anticipo | Oportunidades vinculadas al cliente; responsable/etapa/fecha | Webhook/doble clic no duplican; conflicto de edición visible |
| Clientes | Postgres y ficha /clientes/[id] | Lista comercial, reutilizar ficha y portal | Aislamiento entre owners; portal sin datos sensibles |
| Conversaciones | PixelBot como historial WhatsApp | Referencia comercial; correo propio y outbox duradero | Recepción repetida una vez; envío incierto no reintenta a ciegas |
| Asistente | PixelBot, simulador de borrador | Política explícita, respuestas aprobadas, humano por defecto | Descuentos/precios/compromisos/instrucciones escalan |
| Cotizaciones | Editor, cálculo IVA, venta única | Versiones, pertenencia y decisión protegida | Versión vieja rechazada; decisión idempotente |
| Proyectos | Aprovisionamiento por venta cobrable | Etapa comercial, nota, próxima fecha e historial | Un proyecto; portal propio; sin alterar cobros |
| Cobros | Billing y recordPayment congelados | Presentación y recordatorios pausables | Parcial correcto, pagado sin aviso, envío no es pago |
| Ajustes | Egress y configuración proveedores | Comprobación real y requisitos sin secretos | Nunca conectar por presencia de variable |

La activación mantiene la condición canónica de venta cobrable/anticipo (ADR-0057); la referencia visual no cambia esa condición. No se modifica recordPayment ni la aritmética. Producción conserva su release; WO547 bloquea despliegue sin margen de disco. No se autoriza merge, mensajes reales ni automatización productiva con esta orden.

Migración aditiva 0053 aplicada y repetida en PostgreSQL 16 aislado. Backup QA restaurado y comparado sin diferencias en pagos, cotizaciones, proyectos y conversaciones. Egreso local deshabilitado. Fixtures exclusivos de QA no representan clientes o dinero reales. [Evidencia](../evidencias/wo566/README.md) y [operación](Operación%20y%20activación.md).

Decisión de alcance: esta solicitud autoriza la nueva interfaz y su adaptación, sin alterar el núcleo financiero congelado ni cambiar infraestructura/proveedores. El diseño utiliza datos reales del owner; no importa clientes ficticios del HTML. Los botones de simulación del prototipo se sustituyen por confirmación y estados de proveedor, sin debilitar CSP.
