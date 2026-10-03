# Ejecución SEO del rediseño — 2026-10-03

Primer lote técnico implementado y validado en la rama de diseño. Conserva el inicio de Miguel, 60 slugs y sus metadatos publicados; completa contenido semántico ES en guías/legales y establece una política explícita de idioma. **No es un release listo para producción ni el cierre del plan maestro.**

## Qué cambió y por qué

- Las 144 rutas tienen un H1 en el HTML inicial y un grafo JSON-LD por página. El inicio guarda su plantilla de runtime en JSON inerte para evitar encabezados duplicados; conserva primera vista visible y cubo. La introducción de Nosotros es H2; etiquetas de cubo/menú/pie ya no contaminan el outline.
- La identidad estructurada se extrae de `src/lib/seo/site-graph.ts`, compartida con la aplicación y derivada de `SITE`. Se añaden WebPage, breadcrumb y Service/BlogPosting según contenido. No se inventan reseñas, direcciones ni FAQ rich results. Las 72 pruebas SEO existentes confirman la extracción sin regresiones observadas.
- `src/seo-policy.ts` distingue exclusiones existentes y traducciones incompletas. Hreflang solo aparece entre candidatos equivalentes; el selector sigue disponible en todas las rutas. Las 52 páginas EN sin traducción integral se identifican como pendientes; no entran al sitemap candidato. La adaptación comercial aún requiere revisión editorial.
- Legales ES completos y 38 páginas ES de guías/presencia local recuperan su estructura publicada, incluyendo listas y enlaces. El capturador conserva nodos permitidos, valida con Zod y escapa contenido. Los correos omitidos por componentes cliente en los legales se restauran desde la identidad canónica de la aplicación. No se modifican condiciones legales.
- Se incorporan metadatos sociales y descripciones específicas en las nuevas rutas; las 60 combinaciones ES de title/description/canonical existentes se preservan. Las rutas explícitas de error ahora devuelven 404, igual que las desconocidas.
- Next.js deja de ignorar errores de TypeScript al compilar. La compilación completa pasa con esa protección activada. No se cambian dependencias ni se despliega.

## Search Console: línea base real

Lectura autorizada de la propiedad `sc-domain:pixeltec.mx` en la sesión de Miguel, exportada el 2026-10-03. Datos curados en [gsc-baseline-2026-10-03.json](gsc-baseline-2026-10-03.json); ZIP/CSV originales permanecen locales fuera de Git. No se enviaron sitemaps, validaciones, solicitudes de retirada ni cambios de configuración.

| Ventana / filtro | Clics | Impresiones | CTR | Posición media UI |
|---|---:|---:|---:|---:|
| 2026-06-30–09-29, página contiene `https://pixeltec.mx/` | 107 | 1,515 | 7.1% | 11.9 |
| 2026-09-02–09-29, mismo filtro | 105 | 1,208 | 8.7% | 5.7 |

El filtro excluye www y Encino. No restar estas impresiones a las del total de propiedad: la agregación cambia. Los buckets de dispositivos del CSV suman 55 clics y no reconcilian con el total mostrado; quedan declarados, sin inferir participación por dispositivo. Consultas visibles con clics son de marca, pero no prueban que todo el tráfico lo sea. No se midieron conversiones; falta el histórico de 16 meses y fuentes de backlinks.

Prioridad respaldada por las páginas de tres meses: inicio (99 clics/226 impresiones), Nosotros (2/309), artículo de privacidad en IA (1/125), Contacto (1/103), Equipo (0/151) y Servicios (0/131). Proteger esas rutas y revisar intención/fragmento visible, sin atribuir el CTR a una única causa ni consolidar landings por similitud de nombre.

- **Acciones manuales:** «No se ha detectado ningún problema». Solo acredita ese informe; no diagnostica cambios algorítmicos.
- **Sitemap:** Correcto, 60 páginas descubiertas, última lectura 2026-09-30. Una petición directa del capturador recibió 403; esto no demuestra bloqueo a Googlebot ante la lectura correcta que muestra GSC.
- **Indexación, corte 2026-09-20, dominio completo:** 75 indexadas y 204 no indexadas: 62 redirecciones, 39 alternativas con canonical, 15 no encontradas, 5 noindex, 67 rastreadas y 16 descubiertas sin indexar. No todas son defectos; incluye subdominios y exclusiones deliberadas.
- **Encino:** 8 de las 15 URLs 404 corresponden a ese proyecto. Miguel confirmó que fue retirado y cambió de dominio. Se excluye de este rediseño; el dominio nuevo no se indicó y no se inventa. Sin cambios en su infraestructura.
- Las otras siete 404 mezclan rutas antiguas, recursos y probes. `/seo-services/` requiere confirmar intención/equivalencia histórica antes de decidir; no se creó una redirección masiva a inicio.
- **Core Web Vitals:** Sin datos en móvil y escritorio. No hay certificación de experiencia real.

## Inventario y continuidad

[seo-inventory.json](seo-inventory.json) es evidencia generada del candidato y fuentes observadas; el mapa editorial canónico sigue en `docs/seo/URL-INTENT-MAP.md`. Incluye 144 rutas, política de idioma/indexación, fuente/hash, status esperado y redirects existentes de Next. GSC añade el artículo retirado `/blog/escalabilidad-en-la-nube-con-nextjs-y-firebase`, que ya tiene redirect permanente a `/blog` en la aplicación; no se pierde ni se resucita.

[sitemap-candidate.xml](sitemap-candidate.xml) enumera 86 candidatos, **solo para revisión**: no se sirve, no contiene lastmod inventados y no reemplaza `src/app/sitemap.ts` dinámico/CMS. `productionReady` sigue en false. Privadas, utilidades, exclusiones editoriales e idiomas incompletos permanecen fuera. La simulación no enumera todo el índice de Google ni verifica todos los backlinks.

## Validación reproducible

Desde `design/landingpagepixel2.0`: `npm ci && npm run verify`. Desde raíz: `npm ci --ignore-scripts`, `npm run typecheck`, `npm run build` y los cinco archivos de pruebas SEO de componentes/lib. Los comandos de este lote finalizaron con éxito.

| Control | Resultado |
|---|---|
| TypeScript estricto / build | PASS en prototipo y Next.js |
| Regresiones prototipo | 9/9; 145 HTML, 8,170 referencias locales, 60 slugs/metadatos conservados |
| HTTP de 144 rutas | 142 respuestas 200 + 2 rutas explícitas 404; desconocida 404 |
| SEO existente | 72/72 pruebas en cinco archivos |
| Grafo / idioma | 144 grafos únicos por página; alternates condicionados a equivalencia candidata |
| Contenido | Listas de guías/legales preservadas; enlaces/HTML escapados; correo legal restaurado |
| Diseño | Inicio y guía a 1280 px; seis plantillas a 390 px; un H1 y sin overflow; idioma/menú comprobados; consola sin errores observados |
| Identidad del inicio original | SHA-256 `b49e6c58fbe039b35e6ac5ad8685939ca8023d49d3d4d0b07657e9fb44df6e02` intacto |

Lighthouse 13.5.0, Chrome headless, tres cargas frías secuenciales por perfil sobre `/`. [Métricas, entorno y hashes](seo-performance-2026-10-03.json):

| Perfil | Score mediana (rango) | LCP mediana | TBT mediana (peor) | CLS |
|---|---:|---:|---:|---:|
| Móvil simulado | 98 (97–98) | 2.40 s | 51 ms (65.5 ms) | 0 |
| Escritorio | 100 (100–100) | 0.65 s | 0 ms | 0 |

Reproducir: `npx --yes lighthouse@13.5.0 http://127.0.0.1:4317/ --only-categories=performance --output=json --output=html --output-path=/ruta/local/reporte --chrome-flags=--headless --quiet`; añadir `--preset=desktop` para escritorio. No ejecutar compilaciones simultáneas al medir. La serie se repitió tras el empaquetado final; el JSON conserva también el resumen/hash de la serie preparatoria. Son datos locales de este HTML, no una comparación causal controlada con las series previas, ni INP real, ni auditoría de todas las plantillas/idiomas.

## Deuda abierta y siguiente lote

El [plan maestro](plan-maestro-seo-2026-10-03.md) continúa vigente. No marcar sus doce entregables completos por estas pruebas locales.

1. Completar traducción integral y revisión editorial EN (incluye artículos, guías y legales); distinguir traducción de aprobación de condiciones.
2. Integrar diseño en Next.js con contenido principal completo servido inicialmente. El hero inicial actual no equivale a render completo del inicio; las demás secciones aún dependen del runtime DC.
3. Conservar CMS/publicación dinámica, herramientas interactivas de artículos, contacto/diagnóstico reales, consentimiento y portal/autenticación/RBAC. El prototipo no es sustituto de esos flujos; los enlaces «publicación original» no resuelven paridad una vez reemplazado el sitio.
4. Revisar muestras de las 67/16 URLs sin indexar, histórico largo, backlinks, canonical elegido y conversiones; no reparar exclusiones masivamente. Revisar la señal de 16 alertas remotas de dependencias antes del release; aquí no se analizó aplicabilidad ni se declararon resueltas.
5. Validar candidato integrado, seguridad afectada, accesibilidad/multimotor y rendimiento por plantilla. Preparar rollback/configuración y aprobación humana del release. Después, medición por cohortes día 7/14/28.

## Operación y límites

Preview local `http://127.0.0.1:4317/`, proceso propio reiniciado como PID 62822 para cargar el status 404 corregido. Escucha solo localhost y mantiene noindex/nofollow. No se cambió pixeltec.mx, Encino, servidor productivo, GSC ni sitemap publicado. Restaurar el viewport después del QA. La copia del Desktop/armazon es un entregable generado; el código mantenible vive en esta rama y comparte la identidad SEO con la aplicación raíz. `application-seo.mjs` regenera una exportación pública con hashes en el repo; el paquete autónomo usa esa exportación validada con Zod para poder compilar sin duplicar decisiones de identidad ni requerir la aplicación privada completa. Antes de publicar se refresca desde el repo.
