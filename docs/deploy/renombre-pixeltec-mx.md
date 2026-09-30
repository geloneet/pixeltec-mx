# Renombre operativo de Pixeltec.mx

Fecha: 2026-09-29
Estado: plan aprobado como nomenclatura por ADR-0070 del vault; corte técnico pendiente de gates.
Alcance: GitHub/local, aplicación, Compose, PostgreSQL, VPS, Nginx, wrapper y crons.
PIXELOS (programa Mac) no forma parte del cambio.

## Avance verificado el 2026-09-29

- GitHub ya se llama `geloneet/pixeltec-mx`. El `origin` común de los worktrees registrados apunta a `git@github.com:geloneet/pixeltec-mx.git`. La rama `codex/rename-pixeltec-mx` está publicada; PR borrador #146 abierto; falta revisión y merge a `main`.
- Backup fresco privado: `/home/ubuntu/backups/postgres/rename-pixeltec-mx/pre-cutover-20260930T004853Z.pgdump` (UTC), modo `0600`, 356533 bytes, SHA-256 `191d354a8e20714a706c567ecb17b5bcedac7911620ba9cc60fac62671c57cf7`. El dump contiene 63 entradas de datos de tabla.
- Restauración ensayada en un contenedor PostgreSQL 16 aislado (`--network none`, sin puertos). `pg_restore --exit-on-error` terminó correctamente. Tablas públicas: 62 origen / 62 restauradas. Conteos `users, clients, invoices, blog_posts, drizzle.__drizzle_migrations`: `3, 6, 0, 6, 45` en ambos. El contenedor y volumen de ensayo se retiraron tras la verificación; la app y DB originales siguieron `running`.
- Este respaldo es una foto previa para comprobar recuperación. La base puede recibir escrituras después: antes del corte hace falta un dump final con las escrituras pausadas y un nuevo cotejo.

- PRs de coordinación: `geloneet/pixeltec-infra#2` (Nginx, catálogo, Certbot y respaldo diario) y `geloneet/pixeltec-vps-api#39` (sesión, DB, salud y rutas) son borradores. El vhost productivo tiene 67 líneas locales de rutas Subsify; se incorporaron al PR de infra sin sobrescribir el VPS. Los tres PRs deben entrar en un mismo corte gobernado.

## Estado observado antes del cambio

Auditoría de solo lectura al VPS `198.100.155.231` el 2026-09-29:

- App, QA runner, DB, red y volumen Compose llevan el slug anterior.
- El DB container atiende PostgreSQL 16; su volumen persistente mide ~71 MB.
- La base y el rol actuales tienen el identificador anterior. La app usa el puerto local 5437.
- Nginx en `pixeltec-infra` apunta al nombre DNS Docker anterior en `web-network`.
- El checkout, las releases, el comando instalado, su lock/log y tres crons usan rutas con el nombre anterior.
- Al comenzar, el repo remoto era `geloneet/pixeltec-os`; clones y worktrees se encontraban en varias rutas. Hay worktrees con cambios sin commit que no se deben mover ni limpiar hasta conciliarlos con sus propietarios.
- La inspección inicial superficial no detectó el directorio profundo `/home/ubuntu/backups/postgres/dumps/`. La inspección ampliada encontró dumps diarios, incluido el de 2026-09-29. Se creó además la copia fresca de esta intervención y se restauró con PostgreSQL 16; el `pg_restore` del host es anterior y no entiende la versión del archivo.
- No se cambia DNS ni TLS. El VPS aloja otros servicios y clientes: no ejecutar limpiezas globales de Docker ni tocar productos vecinos.

## Secuencia con conservación de datos

1. Revisar el diff, actualizar la ficha y registrar evidencia. No desplegar esta rama directamente: requiere entrar por `main` y por el wrapper gobernado.
2. GitHub y el `origin` común ya fueron renombrados. Conciliar ahora las rutas locales y los worktrees con sus propietarios. No reutilizar ni borrar un worktree con cambios ajenos; comprobar los redirects del host y dependencias que apunten a la URL antigua.
3. El respaldo privado y su restauración aislada ya pasaron. Antes del corte, comprobar que los dumps diarios siguen llegando, verificar espacio/disco de nuevo y tomar el dump final después de pausar escrituras. Comparar inventario de tablas, migraciones y conteos; no continuar si difieren sin explicación.
4. Provisionar el DB nuevo con rol/base `pixeltec_mx` en su volumen nuevo, en red interna separada y puerto de host temporal libre (por ejemplo 5438, después de comprobar ocupación). Restaurar el dump con ownership/ACL reconciliados y validar la URL de conexión nueva con secretos enmascarados.
5. Preparar `pixeltec-infra` y `pixeltec-vps-api` sin activar aún sus nuevos defaults. Conservar el vhost Subsify real y hacer `nginx -t` antes de la recarga. Preparar el volumen `pixeltec-mx_certbot-webroot` para que Nginx y Certbot usen el mismo mount; no interrumpir la renovación TLS. Versionar/instalar `pg-backup-all.sh` del PR de infra después de existir la nueva DB y comprobar un dump diario nuevo. Construir la app bajo los nombres nuevos y ejecutar health checks directos contra `pixeltec-mx`, además del DB restaurado. El motor de deploy verifica `/`, `/login` y `/api/health` dentro del contenedor nuevo: la respuesta de Nginx todavía puede corresponder a la app antigua antes del corte. Mantener el servicio viejo público, volumen viejo y wrapper anterior intactos durante toda esta fase.
6. Ventana de corte: pausar escrituras/cron de negocio; detener únicamente la app vieja; tomar dump final consistente y restaurarlo en la DB nueva; verificar ledger de Drizzle y conteos. Arrancar la app nueva y mover Nginx a `pixeltec-mx:3000`; validar salud interna y rutas públicas HTTPS. Rehabilitar crons con rutas/env nuevos y reiniciar `vps-api` con `CRM_ENV_FILE`/DB nuevos una vez pasada la verificación de la app. Confirmar autenticación de Intranet y salud del backup diario.
7. Mantener DB/volumen, imagen, release, wrapper y logs anteriores sin cambios durante la ventana acordada. Rollback: pausar crons nuevos, restaurar Nginx al upstream anterior, reactivar app anterior contra su DB/volumen intactos y verificar `/` y `/login`. No copiar datos del DB nuevo de vuelta sin un plan específico para conciliación de escrituras.
8. Solo después de aprobación de Miguel tras el periodo de observación, retirar los nombres y recursos antiguos restantes. La baja de volúmenes/imágenes y la ruta antigua es una operación separada, respaldada y explícita; no forma parte del corte inicial.

## Gates que aún faltan

- [x] Backup y restauración ensayada con evidencia verificable; repetir dump final tras pausar escrituras.
- Ruta oficial y espacio suficiente para respaldo y copia temporal (el audit observó ~26 GB libres; revisar de nuevo al ejecutar).
- Auditoría de ocupación de puerto temporal y usuarios de la DB desde el Mac/VPS.
- [x] PR borrador de `pixeltec-infra`: upstream Nginx, `projects.json`, Certbot y productor diario de backups. Pendiente merge/instalación bajo GO de corte.
- [x] PR borrador de `pixeltec-vps-api`: defaults de CRM, salud y rutas. Pendiente merge/instalación bajo GO de corte.
- [x] Repo GitHub renombrado y `origin` común actualizado. Pendiente conciliar rutas de clones/worktrees ajenos antes de retirar el path antiguo.
- Revisión de diff, verificación de código y GO de ventana de corte por Miguel.
- Veredicto de salud post-corte y cierre documental antes de retirar rollback.

El plan no autoriza copiar secretos a logs, eliminar el volumen anterior, podar imágenes, cambiar DNS/TLS ni afectar PIXELOS u otros proyectos del VPS.
