# ¿Cuándo permite Pixeltec.mx iniciar un despliegue?

WO547, 2026-10-08. El wrapper canónico exige disco <=85% y al menos20GiB disponibles tanto en el filesystem del proyecto como en `/var/lib/docker`. Datos ausentes o ilegibles bloquean. También aplica a `--check-only` y SHAs anteriores, antes de fetch, extracción, Docker o activación. No cambia autenticación ni datos.

Motivo: WO544 observó aproximadamente8GiB de crecimiento durante un build, pasando de81% a89%.20GiB es una reserva inicial conservadora que debe recalibrarse con mediciones; no garantiza capacidad ante escritores externos ni crecimiento ilimitado. No hay bypass por variable de entorno del umbral.

Instalar la plantilla versionada `scripts/deploy/deploy-pixeltec-mx-wrapper.sh` como `/usr/local/sbin/deploy-pixeltec-mx`, root:root0755, conservando copia previa. Validar sintaxis, hash y ejecutar check-only contra un SHA aprobado. Con el disco actual89% debe rechazar sin tocar la aplicación. Tras recuperar capacidad, repetir el camino normal; no modificar umbrales para forzar un build.

El flock existente serializa sólo Pixeltec.mx. La reserva compartida con operaciones de Intranet y otros proyectos sigue pendiente; este cambio no certifica exclusión global. No elimina imágenes, cachés, respaldos ni volúmenes.
