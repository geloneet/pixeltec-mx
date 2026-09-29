# Renombre operativo de Pixeltec.mx

Fecha: 2026-09-29
Estado: plan aprobado como nomenclatura por ADR-0070 del vault; corte técnico pendiente de gates.
Alcance: GitHub/local, aplicación, Compose, PostgreSQL, VPS, Nginx, wrapper y crons.
PIXELOS (programa Mac) no forma parte del cambio.

## Estado observado antes del cambio

Auditoría de solo lectura al VPS `198.100.155.231` el 2026-09-29:

- App, QA runner, DB, red y volumen Compose llevan el slug anterior.
- El DB container atiende PostgreSQL 16; su volumen persistente mide ~71 MB.
- La base y el rol actuales tienen el identificador anterior. La app usa el puerto local 5437.
- Nginx en `pixeltec-infra` apunta al nombre DNS Docker anterior en `web-network`.
- El checkout, las releases, el comando instalado, su lock/log y tres crons usan rutas con el nombre anterior.
- El repo remoto actual es `geloneet/pixeltec-os`; clones y worktrees se encuentran en varias rutas. Hay worktrees con cambios sin commit que no se deben mover ni limpiar hasta conciliarlos con sus propietarios.
- En `/home/ubuntu/backups` y el home inspeccionado no se encontró un respaldo identificable de esta base. Esto no demuestra que no exista en otra ubicación; hay que localizarlo y comprobar restauración antes del corte.
- No se cambia DNS ni TLS. El VPS aloja otros servicios y clientes: no ejecutar limpiezas globales de Docker ni tocar productos vecinos.

## Secuencia con conservación de datos

1. Revisar el diff, actualizar la ficha y registrar evidencia. No desplegar esta rama directamente: requiere entrar por `main` y por el wrapper gobernado.
2. Antes de mover GitHub, conciliar todos los clones/worktrees. No reutilizar ni borrar un worktree con cambios ajenos. Renombrar el repo remoto a `geloneet/pixeltec-mx` y ajustar `origin` solo cuando los propietarios tengan sus cambios registrados y la ruta redirigida del host esté confirmada.
3. En VPS, verificar disco y localizar el mecanismo oficial de respaldos. Crear un `pg_dump` consistente de la DB actual bajo la ruta privada aprobada; registrar tamaño/hash/fecha sin imprimir secretos. Restaurarlo en una DB/instancia aislada y comparar inventario de tablas, migraciones, conteos de tablas de negocio seleccionadas y lectura de documentos. No continuar si la restauración no pasa.
4. Provisionar el DB nuevo con rol/base `pixeltec_mx` en su volumen nuevo, en red interna separada y puerto de host temporal libre (por ejemplo 5438, después de comprobar ocupación). Restaurar el dump con ownership/ACL reconciliados y validar la URL de conexión nueva con secretos enmascarados.
5. Construir la app bajo los nombres nuevos y ejecutar health checks privados contra el DB restaurado. Mantener el servicio viejo público, volumen viejo y wrapper anterior intactos durante toda esta fase.
6. Ventana de corte: pausar escrituras/cron de negocio; detener únicamente la app vieja; tomar dump final consistente y restaurarlo en la DB nueva; verificar ledger de Drizzle y conteos. Arrancar la app nueva y mover Nginx a `pixeltec-mx:3000`; validar salud interna y rutas públicas HTTPS. Rehabilitar crons con rutas/env nuevos una vez pasada la verificación.
7. Mantener DB/volumen, imagen, release, wrapper y logs anteriores sin cambios durante la ventana acordada. Rollback: pausar crons nuevos, restaurar Nginx al upstream anterior, reactivar app anterior contra su DB/volumen intactos y verificar `/` y `/login`. No copiar datos del DB nuevo de vuelta sin un plan específico para conciliación de escrituras.
8. Solo después de aprobación de Miguel tras el periodo de observación, retirar los nombres y recursos antiguos restantes. La baja de volúmenes/imágenes y la ruta antigua es una operación separada, respaldada y explícita; no forma parte del corte inicial.

## Gates que aún faltan

- Backup y restauración ensayada con evidencia verificable.
- Ruta oficial y espacio suficiente para respaldo y copia temporal (el audit observó ~26 GB libres; revisar de nuevo al ejecutar).
- Auditoría de ocupación de puerto temporal y usuarios de la DB desde el Mac/VPS.
- Cambios coordinados en `pixeltec-infra`: upstream Nginx, `projects.json`, wrapper/cron references y sus respaldos gobernados.
- Conciliación de clones/worktrees, movimiento/renombre del repo GitHub y aceptación del nuevo `origin`.
- Revisión de diff, verificación de código y GO de ventana de corte por Miguel.
- Veredicto de salud post-corte y cierre documental antes de retirar rollback.

El plan no autoriza copiar secretos a logs, eliminar el volumen anterior, podar imágenes, cambiar DNS/TLS ni afectar PIXELOS u otros proyectos del VPS.
