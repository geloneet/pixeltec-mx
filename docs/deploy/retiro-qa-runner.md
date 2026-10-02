# Retiro del qa-runner huérfano (WO-2026-00485)

Fecha: 2026-10-02
Estado: **cambio de repo en PR borrador; la retirada en el VPS NO se ha ejecutado.** Requiere su propio gate de Miguel (`vps-retiro-qa-runner`), posterior al merge.
Decisión: D-27 (Miguel, 2026-10-02): no resucitar PixelForge; retirar el qa-runner huérfano.

## Contexto

- `qa-runner` era el QA de navegador (Playwright) de PixelForge F8-T6. PixelForge y `scripts/qa-runner/` se eliminaron en `53212ced` (2026-08-28, WO-2026-00132).
- `docker-compose.yml` seguía declarando el servicio `qa-runner` (container `pixeltec-mx-qa-runner`, build `target: qa-runner`), y el `Dockerfile` seguía teniendo el stage `qa-runner` con `CMD ["npx", "tsx", "scripts/qa-runner/index.ts"]`. Cualquier build de ese servicio genera una imagen que falla al arrancar (`ERR_MODULE_NOT_FOUND`).
- Según `docs/deploy/renombre-pixeltec-mx.md`, tras el corte del 2026-09-30 `pixeltec-mx-qa-runner` quedó **detenido**, y la app no lo llama en runtime.

## Qué cambia en el repo (este PR)

- `docker-compose.yml`: se elimina el servicio `qa-runner` y su bloque de comentarios. No había redes, volúmenes ni secrets exclusivos suyos: `pixeltec-mx-internal` la comparten `db`, `migrator` y `seed`, y `env_production` la usa `app`.
- `Dockerfile`: se elimina el stage `qa-runner` (base `mcr.microsoft.com/playwright:v1.61.1-noble`). Ningún otro stage dependía de él (`--from=` solo apunta a `deps` y `builder`).
- La configuración resuelta de `docker compose config` (con el perfil `tools`) es idéntica antes y después para `app`, `db`, `migrator`, `seed`, `networks`, `volumes` y `secrets`.
- El motor de deploy (`scripts/deploy/production-deploy.sh`) solo hace `build app` y `up -d --no-build --no-deps app`, sin `--remove-orphans`. Por eso, después del merge, un deploy normal **no** borra el contenedor viejo: Compose solo avisará `Found orphan containers ([pixeltec-mx-qa-runner])`. La retirada efectiva es explícita y se hace en un paso aparte (abajo).

## Plan de retirada efectiva en el VPS (para el gate; no ejecutado)

Requisitos previos: este PR fusionado en `main` y desplegado por el wrapper gobernado, y GO explícito de Miguel para este gate. Solo afecta a `pixeltec-mx-qa-runner` y a su imagen. **Prohibido** `docker system prune`, `docker image prune` o cualquier limpieza global: el VPS aloja otros proyectos.

### 0. Inventario (solo lectura)

```bash
docker ps -a --filter "name=^pixeltec-mx-qa-runner$" \
  --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}'
docker inspect pixeltec-mx-qa-runner \
  --format '{{.Config.Image}} {{.Image}} {{index .Config.Labels "com.docker.compose.project"}}'
docker images --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' | grep -i qa-runner
docker ps -a --filter "ancestor=pixeltec-mx-qa-runner:latest" --format '{{.Names}}'
```

Resultado esperado: un solo contenedor `pixeltec-mx-qa-runner` en estado `Exited`, del proyecto Compose `pixeltec-mx`, con la imagen `pixeltec-mx-qa-runner:latest` (unos 5,17 GB según el reporte del Supervisor; hay que confirmarlo aquí). Si aparece algún contenedor en `Up`, o la imagen la usa otro contenedor, **detente** y repórtalo.

También hay que anotar si sigue existiendo un qa-runner con el **nombre anterior al renombre**. Según `renombre-pixeltec-mx.md`, forma parte del rollback de ese corte, así que **no se toca en este gate**: se retira con el cierre del rollback del renombre.

### 1. Respaldo de rollback (opcional, decide Miguel)

La imagen está rota y su código fuente ya no existe, así que su valor para un rollback es mínimo. Si aun así se quiere conservar:

```bash
docker image tag pixeltec-mx-qa-runner:latest pixeltec-mx-qa-runner:retirado-20261002
# o un archivo fuera de Docker (≈5 GB; antes revisa espacio con df -h):
# docker save pixeltec-mx-qa-runner:latest | gzip > /home/ubuntu/backups/qa-runner-retirado-20261002.tar.gz
```

Ojo: si se crea el tag, la imagen **no** libera espacio hasta que se borre ese tag.

### 2. Parar y quitar el contenedor

```bash
docker stop pixeltec-mx-qa-runner   # idempotente si ya está Exited
docker rm pixeltec-mx-qa-runner
```

Se usa `docker rm` con el nombre exacto y no `docker compose rm` ni `up --remove-orphans`, para que no se toque ningún otro servicio del proyecto.

### 3. Quitar la imagen

```bash
docker image rm pixeltec-mx-qa-runner:latest
```

Sin `-f`. Si Docker responde que la imagen está en uso, vuelve al paso 0. Las capas que comparte con otras imágenes no se borran: Docker lo gestiona solo.

### 4. Comprobar que desapareció

```bash
docker ps -a --filter "name=^pixeltec-mx-qa-runner$" --format '{{.Names}}'   # vacío
docker images pixeltec-mx-qa-runner --format '{{.Repository}}:{{.Tag}}'     # vacío (o solo el tag de respaldo)
docker compose -p pixeltec-mx -f <release>/docker-compose.yml config --services  # db, app
docker ps --filter "name=^pixeltec-mx$" --filter "name=^pixeltec-mx-db$" --format '{{.Names}} {{.Status}}'  # ambos Up/healthy
curl -fsS -o /dev/null -w '%{http_code}\n' https://pixeltec.mx/api/health   # 200
df -h /var/lib/docker   # registrar el espacio liberado
```

Además: si el inventario del monitor de `pixeltec-vps-api` lista `pixeltec-mx-qa-runner`, ajustarlo es un frente aparte de ese repo. Este WO no lo toca.

### Orden y rollback

El orden es 0 → 1 (opcional) → 2 → 3 → 4. `app` y `db` no se reinician en ningún paso.

Rollback:
- Si en el paso 2 o 3 algo falla, parar y reportar. `app` y `db` no se ven afectados.
- Para restaurar el contenedor tal como estaba (detenido, imagen rota): `docker image tag pixeltec-mx-qa-runner:retirado-20261002 pixeltec-mx-qa-runner:latest` (o `docker load < …tar.gz`) y recrearlo con el compose de una release **anterior** a este PR. No tiene utilidad funcional, porque el código que ejecutaba ya no existe.
- Revertir el cambio de repo: `git revert` del commit de este PR. Esto solo vuelve a declarar un servicio roto, así que no se recomienda.
