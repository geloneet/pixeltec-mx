# WO-2026-00513 — Rendimiento y SEO de pixeltec.mx

Auditoría del 6 de octubre de 2026 sobre producción. Alcance: web pública, muestras móviles/escritorio, indexación y datos estructurados. No equivale a certificación de todo el hardware, accesibilidad completa ni seguridad integral del panel.

## Mediciones reales de Google

Orden de categorías: rendimiento / accesibilidad / buenas prácticas / SEO. Lighthouse 13.5.0, Chromium 153. Móvil: Moto G Power emulado y 4G lenta. Sin datos CrUX suficientes; TBT es una medida de laboratorio, no INP de usuarios reales.

| Página y dispositivo | Antes | Después | LCP antes → después | TBT antes → después | CLS después |
|---|---|---|---|---|---|
| Inicio móvil | 56 / 93 / 100 / 100 | 88 / 100 / 100 / 100 | 4.3 → 3.8 s | 2140 → 30 ms | 0 |
| Inicio escritorio | 68 / 93 / 100 / 100 | 97 / 100 / 100 / 100 | 0.8 → 0.9 s | 2020 → 140 ms | 0.002 |
| Servicios móvil | 90 / 96 / 100 / 100 | 90 / 96 / 100 / 100 | 3.5 → 3.5 s | 90 → 70 ms | 0 |

| Blog móvil | 85 / 97 / 92 / 100 | 81 / 97 / 100 / 100 | 3.8 → 4.2 s | 170 → 170 ms | 0.002 |
| Servicios escritorio | — | 99 / 96 / 100 / 100 | — → 0.9 s | — → 50 ms | 0.009 |
| Blog escritorio | — | 99 / 97 / 100 / 100 | — → 0.9 s | — → 40 ms | 0.006 |

Medición final a las 15:12 México sobre a5e9929.

Informes: [Inicio antes](https://pagespeed.web.dev/analysis/https-pixeltec-mx/d76ftph818?form_factor=mobile), [Inicio después](https://pagespeed.web.dev/analysis/https-pixeltec-mx/ckfe8knyvt?form_factor=mobile), [Servicios después](https://pagespeed.web.dev/analysis/https-pixeltec-mx-services/envahip96j?form_factor=mobile). Valores redondeados tal como los presenta Google; los snapshots conservan el detalle y la fecha.

El blog tenía 85 / 97 / 92 / 100. Una medición intermedia dio 79 / 97 / 92 / 100: no se descarta ni se presenta como mejora. Descubrió cuatro precargas sin nonce de next/dynamic. Se conserva en `psi-blog-intermediate.txt`. La importación directa eliminó el error CSP, pero el móvil bajó a 70 / 97 / 100 / 100 (LCP 4.5 s, TBT 440 ms); evidencia `psi-blog-csp-fixed.txt`. Por ello el artículo y su procesador Markdown se trasladaron al servidor, manteniendo sanitización y solo las islas interactivas en cliente. El build reduce First Load JS de 274 a 121 KB (−55.8 %); PageSpeed final: 81 móvil y 99 escritorio, buenas prácticas 100. Recupera la regresión intermedia, pero no supera el 85 móvil inicial: LCP 4.2 s sigue pendiente de optimización. [Informe final del blog](https://pagespeed.web.dev/analysis/https-pixeltec-mx-blog-como-automatizar-procesos-manuales-en-mi-negocio-guia-real/n1ejuzxr7n?form_factor=mobile).

## Qué cambió y por qué

- Cubo aprobado: precarga temprana y póster WebP responsive de 11 966 / 23 904 bytes. Three/WebGL se descarga y monta únicamente al pulsar «Explorar en 3D», con control por teclado y fallback. Se mantienen los límites de resolución, suspensión fuera de pantalla y movimiento reducido. El lienzo del efecto de fondo es independiente; la comprobación usa `.progressive-cube canvas`.
- Consentimiento ES/EN más breve y botón con contraste. Se conserva rechazo accesible y bloqueo de Meta hasta aceptar. WhatsApp se aparta mientras el aviso está presente.
- Valoraciones con rol de imagen; contraste del wordmark, CTA de cabecera y etiquetas de tarjetas.
- Schema con logo vigente; eliminación de nodos genéricos duplicados y Service/ItemList vacíos del hub.
- `lastmod` con fechas reales, sin regenerarse en cada solicitud.
- El mapa deja de enlazar vistas de error y `/en/404` devuelve 404 real.
- CSP: el mismo nonce aleatorio se entrega al renderer de Next y a la respuesta, sustituyendo cualquier valor entrante. No se relaja `strict-dynamic`. El artículo y el procesador Markdown son componentes de servidor para evitar precargas dinámicas sin nonce y procesamiento innecesario en el teléfono. La portada tiene prioridad alta.

## SEO y Google

Rastreo de 135 páginas tras publicar: HTTP 200, canonical, descripción y un H1 presentes; cero JSON-LD inválidos. Sitemap: 70 URLs únicas, indexables, canónicas y sin redirección. 38 imágenes únicas comprobadas sin errores HTTP. Títulos/descripciones únicos entre las páginas indexables. Evidencia JSON en esta carpeta.

Se conservan 64 exclusiones editoriales del catálogo (62 EN, metodología y guías ES); no se añade hreflang hacia versiones noindex. `/en` también conserva su política editorial. HTTPS y dominio canónico redirigen correctamente; login emite `X-Robots-Tag: noindex, nofollow`, privados exigen autenticación. `robots.txt` permite rastreo público y excluye `/api/`: no sustituye autorización ni bloquea la lectura de noindex.

Google Rich Results validó Organización y Negocio local en Inicio, y cuatro elementos en el artículo (BlogPosting, BreadcrumbList, Organization, ProfessionalService). Avisos opcionales `priceRange` y URL de autor no se completan con datos inventados. [Informe del artículo](https://search.google.com/test/rich-results/result?id=Uga6-yDUyjzbB81t6UsVIQ), [Inicio publicado](https://search.google.com/test/rich-results/result?id=3vL4xJHQl5VFWdur7yExrw).

Search Console confirmó **«Se ha enviado el sitemap correctamente» el 6 de octubre**, después de publicar. La tabla conserva la lectura anterior del 30 de septiembre y 60 descubiertas hasta que Google vuelva a procesarlo; el XML actual tiene 70. No se declara indexación inmediata. Evidencia `gsc-sitemap-submitted.txt` y captura.

La cobertura histórica (75 indexadas, 204 excluidas; actualización 20 de septiembre) precede al lanzamiento. La propiedad de dominio incluye Encino. Sus 404 no se atribuyen al sitio principal: 8 ejemplos eran de Encino y 7 de WordPress/URLs inválidas antiguas del dominio principal. No se modificó Encino ni se redirigió todo error a Inicio.

## QA y publicación

TypeScript estricto PASS; 380 pruebas de 25 archivos (auth, RBAC, middleware, CSP, SEO, consentimiento y flujos públicos), batería final de 66 pruebas del artículo, sanitización, contrato público, Markdown, fechas y cubo (incluye repetición de pruebas anteriores). Compilación productiva y 205 páginas PASS. Navegador real: responsive 320/390/768/1440, diagnóstico paso 1→2, menú, WhatsApp EN, cubo inicial sin WebGL propio y un único montaje tras activarlo. Evidencia visual y controles HTTP adjuntos. Son muestras emuladas, no una prueba de todos los dispositivos físicos.

Release de mejoras generales: `060ccdcdb5e59af65d8e636b8dd378b8521be99f`, 14:32 México, wrapper rc0 y rollback=no. Tres compilaciones previas se cancelaron antes de activar para incorporar hallazgos; producción siguió atendiendo. Release intermedia del blog: `252879ba4a778bc872bcb538057ddab1470d0175`, 14:51 México, rc0 y rollback=no. Release final con render del artículo en servidor: `a5e99292f78a71c4f9bc236dea4aa2996d4d29ab`, activa 15:08 México, wrapper rc0, rollback=no; crawler final 135 páginas PASS y artículo completo sin errores de consola observados.

Se limpiaron únicamente cachés recuperables de compilación: tras la última compilación se recuperaron 6.48 GB de caché y quedaron 9.2 GB libres (91 % ocupado). Sin borrar volúmenes, datos ni imágenes de recuperación. QA local usa PostgreSQL desechable en 5452; su advertencia previa de `app_settings` no se confunde con producción.

## Límites y mantenimiento explícito

- Inicio móvil mejora de forma importante, pero LCP 3.8 s todavía supera el objetivo de 2.5 s; no se declara todo el rendimiento en verde. El LCP corresponde al póster del cubo. La precarga ya está implementada. Oportunidades: ruta crítica de fuentes/CSS, DOM y JavaScript compartido, con medición antes de alterar diseño o navegación.
- Accesibilidad automática: Inicio 100; Servicios 96 y Blog 97. Quedan advertencias en plantillas secundarias; no se afirma conformidad WCAG completa.
- Blog móvil: 81 y LCP 4.2 s; priorizar CSS crítico, fuentes y carga visual antes de declarar todos los Core Web Vitals en verde.
- Disco productivo al 91 %: vigilar capacidad y retención de imágenes; esta tarea conservó imágenes de recuperación y no borró datos.
- API Dependabot: 7 alertas abiertas (3 altas, 3 medias, 1 baja); banner GitHub: 9 por distinto estado de actualización. Afectan editor/CSS/build: braces sin parche indicado, Tiptap con actualización mayor, PostCSS anidado de Next y KaTeX. Evidencia `dependency-alerts.json`. Requiere mantenimiento compatible con pruebas del panel; no se demuestra explotación pública ni se certifica ausencia de vulnerabilidades.
- No hay datos CrUX suficientes. Revisar datos de campo cuando Google disponga de muestra; esta tarea no crea monitoreo automático.
- MCP NeuroPIXEL falla por continuidad obsoleta ajena de WO422. Se consultó la fuente canónica por archivos y se publicó selectivamente, sin alterar hashes ajenos.
