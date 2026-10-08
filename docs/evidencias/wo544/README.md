# WO544 — Inicio directo y WhatsApp contextual

2026-10-08. Autorizado por Miguel en el chat: «Y tienes permiso de todos los temas que te deje puedes hgacerlo».

- El indicador cuenta conversaciones pendientes, no mensajes, y descarta valores obsoletos cuando falla la consulta.
- Actividad incluye el último mensaje recibido o enviado, con texto que distingue la dirección. Abre el chat concreto solo si existe en la bandeja autorizada; conserva los controles de acceso del inbox.
- Pipeline y cobros secundarios quedan plegados para priorizar acciones. El estado vacío de tareas no promete ausencia de otros pendientes.
- Fechas civiles YYYY-MM-DD conservan el día en el texto de vigencia, independientemente de la zona del navegador.

Verificación: suite completa 186 archivos/2320 pruebas PASS; typecheck y lint sin errores (advertencia previa de img en progressive-cube). Build optimizado PASS. Regresiones incluyen respuesta saliente, enlace con + escapado, chat desconocido, contador y fecha en America/Mexico_City. Tras revisión se extrajo DetailsPanel y se mejoró selección diferida del chat; controles afectados y compilación final se repiten antes de publicar.

Sin migraciones, mensajes, permisos nuevos ni cambios a datos financieros. Pendiente en este corte: revisión productiva y recibo de despliegue. La apertura de un chat conserva el marcado como leído existente.
