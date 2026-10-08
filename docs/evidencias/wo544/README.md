# WO544 — Inicio directo y WhatsApp contextual

2026-10-08. Autorizado por Miguel en el chat: «Y tienes permiso de todos los temas que te deje puedes hgacerlo».

- El indicador cuenta conversaciones pendientes, no mensajes, y descarta valores obsoletos cuando falla la consulta.
- Actividad incluye el último mensaje recibido o enviado, con texto que distingue la dirección. Abre el chat concreto solo si existe en la bandeja autorizada; conserva los controles de acceso del inbox.
- Pipeline y cobros secundarios quedan plegados para priorizar acciones. El estado vacío de tareas no promete ausencia de otros pendientes.
- Fechas civiles YYYY-MM-DD conservan el día en el texto de vigencia, independientemente de la zona del navegador.

Verificación: suite completa 186 archivos/2320 pruebas PASS; typecheck y lint sin errores (advertencia previa de img en progressive-cube). Build optimizado PASS. Regresiones incluyen respuesta saliente, enlace con + escapado, chat desconocido, contador y fecha en America/Mexico_City. Tras revisión se extrajo DetailsPanel y se mejoró selección diferida del chat; controles afectados y compilación final se repiten antes de publicar.

Sin migraciones, mensajes, permisos nuevos ni cambios a datos financieros. La apertura de un chat conserva el marcado como leído existente.

## Publicación y revisión real

- PR183 integrada como `68c0bbae6f6b6621c8f4c5956097e924ea41c9ab`; wrapper productivo rc0, 2026-10-08 07:28:59Z, rollback=no. Recuperación disponible: `9e7320b306885526e7982be84e7b1c7d0c61219b`. Salud directa `/`, `/login`, `/api/health`:200; Nginx301; cero reinicios. Recibo VPS: `/home/ubuntu/deploy-logs/pixeltec-mx-20261008T071457Z-68c0bbae6f6b-deploy.log`.
- Navegador autenticado: contador2 conversaciones, paneles secundarios plegados, actividad saliente y apertura del chat DEMO correcto. Abrirlo marcó ese chat como leído (contador posterior1), sin enviar mensajes. Vigencia campo23/texto23; formulario cancelado sin guardar.
- La revisión encontró otra regresión: fecha UTC canónica del bot sin sufijo se interpretaba como local en Inicio (8h vs14h en bandeja). Se normaliza a ISO en la frontera de Inicio usando el parser existente; se conserva ISO explícito y descartan fechas ilegibles. Prueba en America/Mexico_City. También se corrige el singular accesible del contador. Esta corrección adicional requiere nuevo recibo de despliegue.
- Revisión móvil390×844: indicadores compactos en dos columnas (detalles comparativos conservados para lectores de pantalla), cabecera más baja y menú sin pestañas de áreas recortadas. Comprobación final:29 pruebas de fecha/actividad,21 de bandeja/adaptador,38 de widgets/navegación y TypeScript PASS. Veredicto móvil posterior al segundo despliegue pendiente.
- Disco81% antes,89% después del build. Mantenimiento estándar sin efecto, recursos preservados: no se declaró resuelto ni se repitió. Acción manual acotada y autorizada de caché regenerable: registro privado `q7cwfbc3k98k0nynsi9vy5e8s`, reclaimable, sin uso15h; `buildx prune --filter id=… --filter until=1h` reportó1.714GB retirados, df88%, contenedor running/restarts0. No cambia la política automática ni elimina imágenes, volúmenes o respaldos.
- Deuda declarada: npm ci en VPS reporta50 vulnerabilidades (2bajas/40moderadas/8altas, incluye dev/transitivas); GitHub9 avisos (3altas/5moderadas/1baja). Requiere análisis separado, no acredita explotabilidad de producción.
