# ¿Qué se integró y qué falta para publicar el nuevo sitio?

2026-10-05 · WO-2026-00509 · rama `design/pixeltec-public-shell-20261002`.

## Estado real

Candidato Next integrado, todavía sin activación productiva. El prototipo aprobado permanece en `design/landingpagepixel2.0`; el archivo original `src/home.dc.html` se conserva. El portafolio público usa `/casos-de-exito`; `/proyectos` sigue perteneciendo al panel privado.

## Implementación

- Layout público persistente con Next Link: navegación, footer, WhatsApp y diagnóstico modal compartidos. Las rutas privadas, autorización y APIs mantienen su implementación.
- Compilador previo convierte la portada aprobada en React. No se distribuye el intérprete de plantilla ni `new Function`; títulos y contenido llegan en el HTML del servidor.
- Páginas interiores compilan a árboles de contenido declarativo. CSS público acotado al layout, recursos locales y overrides separados para regeneración reproducible.
- El blog y sus detalles siguen conectados al CMS; la portada consulta publicaciones reales. Legales y producto `/pixelbot` conservan componentes y conversiones existentes dentro del layout compartido.
- Motor de diagnóstico único: adaptador validado con Zod al motor existente. Seguimiento usa la server action original: consentimiento, validación, antispam, rate limit, persistencia y notificaciones.
- Formularios del cuestionario y seguimiento están separados. No se envían mensajes durante las pruebas automatizadas; acción simulada.
- Parallax con RAF y preferencia de movimiento reducido; diálogos nativos con foco restaurado. Filtros de portafolio con limpieza al navegar.
- Inglés noindex; contenido CMS, legales y autenticación sin traducción redirigen a la ruta española vigente.

## Reproducción

Desde el repo: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`.
Para regenerar presentación: instalar dependencias del prototipo y ejecutar su build, después `node scripts/public-site/compile-home.mjs`, la misma orden con `--en` y `node scripts/public-site/compile-pages.mjs`. Los artefactos generados se versionan; el build productivo no depende del prototipo ni su servidor.

QA usa exclusivamente PostgreSQL local `pixeltec_web_wo509_qa`, creado para esta orden, con migraciones versionadas. La migración existente `drizzle/0044_app_settings.sql`, ausente del journal local, se aplicó explícitamente sólo a esta base QA para completar el esquema. Secretos efímeros del proceso, sin archivos de credenciales. No se modificaron datos productivos.

## Evidencia y límites

- Compilación final Next de producción y TypeScript estricto: PASS.
- Suite final: 166 archivos y 2,143 pruebas PASS, incluyendo consentimiento, error recuperable y diagnóstico.
- Prototipo tiene su propio ejecutor `node --test`; Vitest raíz se limita a `src/**/*.test.{ts,tsx}` para no ejecutar suites Node desde un cwd incompatible.
- `diagnostic-next.png`: diagnóstico modal local, resultado calculado sin navegar ni enviar mensajes.
- Revisión HTTP: 133 rutas, sin respuestas inesperadas; `/proyectos` redirige al login y una ruta inexistente devuelve 404. Inventario de 150 enlaces internos sin destinos ausentes. Evidencia `http-routes.json`.
- Navegador real: diagnóstico completo de cuatro pasos y resultado 67% sin salir de Inicio, navegación cliente Inicio→Servicios, modales y móvil 390px sin overflow; consola final sin errores observados. Capturas `diagnostic-production.png`, `services-production.png`, `home-mobile.png`, `project-mobile.png`.
- No se realizó envío real de lead/notificación ni auditoría de métricas de campo; las acciones están cubiertas por pruebas con mocks. Producción aún conserva la versión anterior.

## Producción y recuperación

Lectura SSH del 2026-10-05: contenedor `pixeltec-mx` activo con imagen y `.deploy-active-sha` `39a8faed5df16a8d336b6d302a47e98de40185dc`; DB sana. Wrapper `/usr/local/sbin/deploy-pixeltec-mx` presente. Nginx corre en Docker; su inventario está en el contenedor `pixeltec-nginx`, no en `/etc/nginx` del host. UFW activo; lectura sin cambios de configuración.

Camino único: SHA completo aprobado y ancestro de `origin/main`, `deploy-pixeltec-mx --sha SHA --check-only`, luego despliegue dentro de tmux. El motor conserva la imagen anterior y revierte ante health fallido. No se ejecutó activación en esta etapa. Checklist operativo: `docs/operacion-web`, servidor local 4870.
