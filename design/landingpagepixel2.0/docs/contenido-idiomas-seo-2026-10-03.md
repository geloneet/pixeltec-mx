# ¿Qué contenido se incorporó y cómo se conserva la continuidad SEO?

El 2026-10-03 Miguel pidió nutrir el diseño con el contenido publicado de pixeltec.mx, añadir inglés y conservar los slugs. Se incorporaron servicios, industrias, equipo, casos, testimonios y contacto a su diseño original. **Se conservan las 60 URLs del sitemap, sus títulos, descripciones y canonical observados.** Se generan 72 páginas ES y 72 EN; no se ha desplegado ninguna.

## Fuente y autoridad

`published-content-2026-10-03.json` es un snapshot de las 60 páginas públicas leído mediante navegador, con URL, texto y metadatos. La página pública es evidencia del contenido que Miguel identificó como aprobado, no prueba independiente de los resultados comerciales. Se reintentaron tres páginas cuyo primer acceso a metadatos devolvió 503; el snapshot final contiene 60 canonical válidos. Una respuesta cacheada de búsqueda para About no coincidía con la web actual: se utilizó el contenido observado directamente en navegador.

Los datos tipados de `src/content.ts` conservan la procedencia: fundador Miguel Robles Sánchez; liderazgo técnico con especialistas por proyecto; Villa Nogal, Pipas Tondoroque, Barro Stock, Smile More y Materiales de Barro; teléfono +52 (322) 137-8336 y contacto@pixeltec.mx. El retrato procede de `/fotodeperfil.jpg` ya publicado y existente en el repo, convertido a WebP. No se añaden empleados, métricas comerciales ni infraestructura. Las imágenes de casos son ilustraciones conceptuales, rotuladas como tales en detalle.

Copy editorial y traducciones nuevos son una adaptación para revisión, no una nueva aprobación atribuida a Miguel. WhatsAgent enlaza a los planes vigentes, evitando duplicar precios/condiciones que puedan cambiar. No se añadieron pagos, contratos ni compromisos de soporte.

## Cobertura por idioma

| Superficie | Español | Inglés |
|---|---|---|
| Inicio, servicios, empresa, equipo, industrias, proyectos y contacto | Contenido público adaptado a la composición original | Traducción comercial |
| Blog | Artículos publicados importados como estructura semántica segura | Resumen identificado con enlace al artículo completo en español |
| Guías y landings locales | H1, introducción y bloques H2/H3/P publicados | Introducción y resumen temático identificado con enlace al original |
| Legal | Enlace al documento oficial vigente | Explicación en inglés y enlace al documento oficial en español |
| Diagnóstico | Cuatro pasos, resumen local | Mismos pasos y mensajes traducidos |
| Acceso | Enlace al portal vigente | Explicación traducida, mismo portal |

Las listas/tablas y widgets de las guías no están todos migrados; los artículos importan listas/tablas pero no ejecutan herramientas interactivas del sitio original. No se presenta esta etapa como sustitución integral del contenido productivo. El inglés de guías/artículos es resumen, no traducción íntegra. La foto original del fundador permanece intacta.

## Contrato de URLs

- ES conserva el sufijo actual, incluidos `/about/`, `/services/`, `/pixelbot/`, rutas locales y slugs completos del blog. El inventario viene del sitemap observado, no de nombres inventados.
- EN usa `/en/` más el mismo sufijo. El selector de idioma lleva a la página equivalente, no siempre a inicio. No se traducen ni se renombran slugs ES.
- Canonical propio por idioma y alternates `es-MX`, `en`, `x-default` recíprocos. Canonical conserva la forma sin slash final del sitio observado (raíz equivalente); navegación local usa directorios con slash.
- `seo-route-map.json` registra cada URL vieja, ruta ES, ruta EN y ausencia de cambio de slug. Preservar slugs no garantiza posiciones de Google: también importan contenido, enlaces, render, canonicals y servidor.
- **Preview protegido:** todos los HTML `noindex,nofollow`, robots `Disallow: /`. No publicar esta salida directamente como sitio real.

## Reproducir y extender

`npm ci && npm run verify` construye y verifica TypeScript strict, referencias locales, rutas, compresión/caché, pesos de assets, identidad SHA-256 del inicio y regresiones SEO/idioma. `npm run preview` sirve solo 127.0.0.1:4317. Editar contenido comercial en `src/content.ts`, traducciones/transformación de portada en `src/home-content.ts`; nunca editar `src/home.dc.html`. Añadir traducciones a ambos idiomas al crear una página. El build valida el snapshot con Zod; el render escapa texto y restringe protocolos de enlaces.

La optimización de HTML reconoce ES y EN: ambas salidas tienen `data-dc-static` para evitar una segunda descarga/reconstrucción del documento. Una regresión detectada en EN durante esta tarea se corrigió y se añadió cobertura de ambos idiomas al presupuesto de rendimiento.

## Condiciones antes de integrar en producción

1. Revisar adaptación editorial y EN; completar traducciones largas, documentos legales e interactividad que deba conservarse. No reemplazar páginas informativas extensas por resúmenes.
2. Integrar al Next.js existente sin modificar contratos del portal, APIs o acceso; trasladar JSON-LD y sitemap de producción según contenido real. El prototipo no migra datos estructurados ni genera el sitemap productivo bilingüe.
3. Mantener rutas ES y canonical existentes; configurar normalización de slash con un único redirect permanente. Solo si una URL cambia, mapearla 1:1 con 301/308 al equivalente; nunca redirigir todas a inicio. Probar status, cadenas y ausencia de soft 404.
4. Retirar noindex/Disallow únicamente del despliegue aprobado, habilitar indexación de páginas EN completas y comprobar hreflang recíproco, canonical, sitemap y robots servidos por el hosting real.
5. Comparar rastreo antes/después, revisar Search Console y métricas de campo. No hay garantía de ranking ni certificación de Core Web Vitals en este prototipo.

La revisión productiva está pendiente y declarada; este cambio es una rama local de diseño con fuentes públicas, no una migración publicada. NeuroPIXEL se consultó por archivos canónicos al fallar el transporte MCP; no se modificaron expedientes ajenos.

## Verificación final y rendimiento

TypeScript strict/build PASS; 145 HTML, 7,457 referencias sin errores y 144 rutas HTTP 200. Cinco pruebas Node pasan (servidor, preservación SEO, idiomas, HTTP y escape seguro); presupuestos ES/EN y SHA del original pasan. Navegador: 20 vistas de diez páginas a 320/390 px sin overflow horizontal, selector contextual About EN→ES, filtro Web con tres casos, menú/Escape con retorno del foco y diagnóstico EN hasta resumen sin envío. Consola consultada sin errores. Se corrigió el anclaje del pie de la ilustración de Nosotros para que el texto no quede recortado.

Lighthouse actual: **100 escritorio ES**, LCP 0.65 s; confirmaciones móviles **86 ES / 88 EN**, LCP ~3.17 s, TBT 292/236.5 ms, CLS 0. Transferencia ~412 KB incluyendo el cubo. Hubo alta variación: ES 76/86, EN antes de corregir la doble carga 67; después 66/88. No se oculta la corrida baja ni se confunde una confirmación con una mediana. Control de la versión previa bajo la carga actual: 87 móvil, LCP 3.00 s, TBT 326 ms. Otros procesos Chrome y WindowServer consumían CPU; eso impide aislar causalmente toda la diferencia respecto al 94 móvil de la sesión anterior. No se afirma rendimiento estable de 94 ni ausencia absoluta de regresión.

`performance-content-2026-10-03.json` conserva todas las mediciones; informes completos en la entrega. Pendiente: medición repetida en estación estable y Core Web Vitals de campo al integrar. LCP móvil sigue por encima de 2.5 s; continúa la deuda de render inicial del runtime DC. El alcance de esta entrega es contenido/idiomas con continuidad de rutas, no certificación de rendimiento productivo.
