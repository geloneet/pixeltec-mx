# ¿Cómo llevar el rediseño de PixelTEC a una entrega SEO completa y verificable?

Conservar el patrimonio de URLs y contenido aprobado, completar español e inglés, integrar el diseño en la aplicación existente y publicar solo después de pasar controles técnicos, editoriales y de conversión. El diseño base sigue siendo el inicio de Miguel; Befox es referencia secundaria. La experiencia fluida y los efectos suaves deben convivir con contenido accesible y enlaces normales.

**Fecha:** 2026-10-03 · **Responsable del plan:** Codex, Marketing, SEO y Contenido · **Decisión editorial y publicación:** Miguel. **Estado:** plan documentado; ejecución pendiente. Esta entrega cambia documentación, no código, indexación ni producción. Las recomendaciones de esta investigación no se convierten por sí solas en reglas aprobadas de NeuroPIXEL.

## 1. Qué significa «al 100%»

- **Preparación completa:** todos los controles aplicables de la sección 6 tienen evidencia vigente y no quedan bloqueos críticos. Cualquier exclusión necesita razón, responsable y efecto documentados; no sirve para ocultar contenido incompleto.
- **Entrega bilingüe completa:** todas las páginas públicas incluidas en el alcance aprobado tienen contenido equivalente y revisado en ES/EN. Las páginas privadas conservan su política propia. Un lanzamiento solo ES puede ser una fase, pero no se declara terminado el objetivo bilingüe.
- **Resultado medido:** después de publicar se comprueba rastreo, indexación, experiencia real y conversiones. Sin suficientes datos de campo se informa «pendiente de evidencia», no «Core Web Vitals aprobados».
- No significa obtener posición 1, indexar cada URL ni alcanzar una puntuación arbitraria. Google no garantiza esos resultados: [guía SEO para principiantes](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

### Continuidad con el SEO anterior — conciliación WO-2026-00504

Este plan es el backlog del rediseño, no sustituye el mapa URL × intención ni vuelve a dar por pendientes mejoras ya entregadas. Antecedentes: PR #139 / `e429858` (home), evidencia `88ec501`, PR #141 / `72ee8a5` (SEO integral), presentes en el historial del repo. Reutilizar metadata, grafo, clústeres y pruebas de esos incrementos; volver a verificar paridad al integrar el diseño.

La WO-345 **histórica** de SEO sí existe en [NeuroPIXEL @80d8d964](https://github.com/geloneet/neuropixel/blob/80d8d96498219b737281004bfac1c0d1e409756a/09_SEGUIMIENTO/workorders/WO-2026-00345.md), junto al [plan integral de septiembre](https://github.com/geloneet/neuropixel/blob/80d8d96498219b737281004bfac1c0d1e409756a/04_PRODUCTOS/Pixeltec.mx/plan-seo-integral-2026-09-14.md). El archivo homónimo en la publicación actual corresponde a Hermes: citar versión + entidad, no el número aislado. No se reescribe ningún acta ni se resuelve aquí esa discrepancia histórica del registro.

`plan-seo-home-2026-09-14.md` aparece citado en seguimiento, pero no fue localizado ni como archivo vigente ni en el historial Git disponible de esa ruta. No se reconstruye de memoria. Los baselines `docs/seo/home-*2026-09-14.*` y los commits anteriores son la evidencia recuperable. La matriz y las responsabilidades vigentes de este plan permanecen; esta conciliación es documental de Ingeniería, sin nuevas decisiones de Marketing.

## 2. Línea base y límites de la evidencia

Corte del prototipo: commit `e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba`. Evidencia versionada: [verificación](https://github.com/geloneet/pixeltec-mx/blob/e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba/design/landingpagepixel2.0/docs/verification.json), [alcance del contenido](https://github.com/geloneet/pixeltec-mx/blob/e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba/design/landingpagepixel2.0/docs/contenido-idiomas-seo-2026-10-03.md) y [mediciones anteriores](https://github.com/geloneet/pixeltec-mx/blob/e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba/design/landingpagepixel2.0/docs/performance-content-2026-10-03.json).

| Aspecto | Comprobado en el prototipo / repo | Falta para producción |
|---|---|---|
| Rutas | 144 rutas, 72 ES + 72 EN; 60 URLs del sitemap observado conservadas | Inventario completo: sitemap no equivale a todas las URLs indexadas o enlazadas |
| Metadatos | Title, description, canonical y alternates; 60 títulos/descripciones/canonical publicados preservados | Política por página y entorno; 25 páginas comparten descripciones genéricas, incluyendo privadas y técnicas |
| Indexación | Todas las rutas del prototipo con noindex/nofollow; robots Disallow /; preview localhost | No trasladar este bloqueo al sitio público. Privadas y borradores siguen excluidos |
| Contenido ES | Comercial adaptado; artículos con estructura semántica | Guías/locales pierden listas, tablas o herramientas; revisar cobertura página por página |
| Contenido EN | Comercial traducido | Artículos y guías largos son resúmenes; revisión lingüística y equivalencia completas pendientes |
| Legales / conversión | Legales enlazan al original; diagnóstico local; enlaces al portal | Restaurar documentos completos y preservar formularios, diagnóstico y rutas funcionales existentes |
| Encabezados | Inicio ES/EN: 2 H1 en HTML fuente, 1 tras montaje | Cumplir convención interna de un H1 sin duplicación de primera vista |
| Datos estructurados | Prototipo sin JSON-LD; producto existente tiene grafo y helpers | Reutilizar grafo productivo; validar entidad, artículos, servicios y breadcrumbs |
| Sitemap | Producto tiene sitemap dinámico; prototipo sin sitemap bilingüe productivo | Conservar publicaciones del CMS y agregar solo traducciones listas |
| Rendimiento | Mediciones históricas: 100 escritorio, confirmaciones 86 ES/88 EN móvil; LCP ~3.17 s | No se midió de nuevo tras el último cambio; falta campo y control estable del build final |

Estas cifras no certifican el sitio público actual. No se consultó una nueva exportación de Search Console en esta investigación. El [baseline GSC del 14 de septiembre](https://github.com/geloneet/pixeltec-mx/blob/e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba/docs/seo/home-gsc-baseline-2026-09-14.md) es histórico, no una medición de hoy.

## 3. Orden de ejecución y entregables

| Fase | Prioridad / dependencia | Trabajo y entregable | Criterio de salida |
|---|---|---|---|
| A. Inventario y protección | P0 · primero | Inventario unificado de URLs, baseline GSC y matriz de conservación | Cada URL conocida tiene destino, intención, idioma y política explicados |
| B. Contenido y arquitectura | P0 · A | Cobertura ES, mapa de intención actualizado, ficha de contenido por plantilla | Ninguna página pública de lanzamiento pierde información aprobada o función útil |
| C. Inglés completo | P1 · B, por lotes | Traducciones equivalentes revisadas y estado editorial por idioma | Sin resúmenes presentados como equivalentes completos ni mezclas accidentales |
| D. Integración técnica | P0 · A/B; C por lote | Diseño en aplicación existente, SEO servido, grafo, sitemap dinámico y pruebas | HTML inicial y renderizado coherentes; CMS y negocio conservados |
| E. Experiencia y rendimiento | P1 · D | QA móvil/escritorio, accesibilidad y medición repetible del candidato | Sin regresiones visuales/funcionales y con presupuestos de rendimiento cumplidos |
| F. Prepublicación | P0 · A–E | Informe de controles, release identificable y rollback comprobable | Cero bloqueos críticos; propuesta concreta revisable por Miguel |
| G. Publicación y seguimiento | P0/P1 · F + autorización | Smoke test, comparación orgánica y seguimiento 28 días | Operación sana; resultados y límites registrados sin confundir variación con causalidad |

Ingeniería ejecuta D/E/F y controles técnicos; Marketing/Contenido prepara A/B/C y analiza G; Miguel valida hechos comerciales, traducciones sensibles y publicación. Son responsabilidades propuestas, no asignaciones a personas inexistentes. El cronograma se estima tras A, según cantidad real de contenido incompleto y acceso a métricas; no hay una fecha de lanzamiento prometida.

### A. Proteger URLs y establecer la línea base

1. Unir sitemap público actualizado, rutas del repo, publicaciones del CMS, redirects existentes, enlaces internos y exportaciones GSC por página/consulta. Incluir URLs con backlinks relevantes y aliases aunque no estén en el sitemap. No borrar nada por estar ausente de un solo origen.
2. Ampliar el [mapa URL × intención existente](https://github.com/geloneet/pixeltec-mx/blob/e5e01e52d867b1fdb4a69fc409d75b07bbd3a5ba/docs/seo/URL-INTENT-MAP.md), sin crear otro mapa canónico competidor. Columnas mínimas: URL actual/canónica/destino, status esperado, indexabilidad, idioma/par, intención, plantilla, fuente aprobada, cobertura, señales históricas y responsable.
3. Conservar `/services`, `/about`, `/contact`, artículos y demás slugs existentes. No traducir retrospectivamente slugs ES por estética. Resolver explícitamente barra final, HTTPS, www/apex y parámetros conservando la convención productiva; el directorio con `/` del prototipo no obliga a cambiar el canonical productivo.
4. Si una URL realmente cambia, documentar redirect permanente 301/308 a su equivalente y comprobar cadenas/bucles. Conservar redirects heredados, incluidos aliases de PixelBot. No redirigir páginas distintas a inicio por comodidad. Un rediseño con mismo dominio y mismas URLs no requiere Change of Address. Base: [migraciones de Google](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes).
5. Actualizar baseline GSC con 28/90 días comparables y hasta 16 meses si están disponibles; separar marca/no marca, país, dispositivo, idioma y host. Registrar conversiones orgánicas reales y fecha de cada cambio. La documentación histórica del conector no prueba acceso o salud actual.

### B. Completar información y enlazado

| Familia | Función y contenido que se debe conservar/completar |
|---|---|
| Inicio | Qué resuelve PixelTEC, para quién, servicios, evidencia real y CTA claro; jerarquía semántica compatible con el inicio de Miguel |
| Servicios y PixelBot | Problema, alcance, proceso, entregables, límites, caso verificable y siguiente paso; no prometer integraciones no aprobadas |
| Industrias y proyectos | Necesidad sectorial y experiencia demostrable; ubicación y alcance reales de cada caso, sin métricas inventadas |
| Páginas locales y por keyword | Utilidad distinta y respaldo local; revisar las 12 ciudad×servicio y 26 por keyword frente a GSC, sin consolidarlas solo por similitud de palabras |
| Nosotros y equipo | Identidad, experiencia verificable, autores y relación con artículos; coherencia de nombre/contacto/área de servicio |
| Blog y guías | Texto completo, listas, tablas, enlaces, imágenes, fuentes, autor/fechas reales y herramientas útiles; cubrir intención antes que cantidad de palabras |
| Contacto, diagnóstico y legales | Datos vigentes, rutas de conversión existentes y documentos íntegros aprobados |

Por URL: comparar fuente aprobada y candidato por secciones/elementos, registrar faltantes y revisar manualmente los cambios de significado. Los enlaces del prototipo legal hacia la misma URL pública se volverían autorreferencias al reemplazar el sitio: son un bloqueo de publicación hasta migrar el contenido real.

Usar una intención principal por página como criterio editorial, sin imponer una keyword exclusiva universal. Comprobar posible canibalización con consulta × URL y propósito real, no asumir penalizaciones. Evitar páginas locales casi idénticas creadas solo para captar variaciones de búsqueda: [políticas de spam](https://developers.google.com/search/docs/essentials/spam-policies).

Mantener el menú de cuatro elementos pedido por Miguel. Inicio sigue accesible por el logo; Blog por pie y enlaces contextuales. Conectar artículo → servicio pertinente → caso → contacto/diagnóstico y hubs → detalles mediante enlaces HTML reales, sin cuotas arbitrarias. Toda página pública indexable debe tener entrada contextual rastreable: [enlaces rastreables](https://developers.google.com/search/docs/crawling-indexing/links-crawlable).

### C. Inglés y política por idioma

- Traducir información, navegación, formularios, errores, CTA, metadatos y textos alternativos relevantes. Revisar terminología, tono, unidades y datos comerciales; no inventar atención, oficinas o condiciones para mercados extranjeros.
- Mantener `/en/` y los pares existentes. Registrar `borrador / traducida / revisada / lista` por página, sin confundir presencia de archivo con aptitud para indexación.
- Para cada traducción lista: canonical propio, `lang` correcto y hreflang absoluto, autorreferente y recíproco. `x-default` solo si hay un destino de reserva coherente. No canonicalizar todo EN a ES ni forzar redirecciones por idioma/IP.
- Alternates solo entre equivalentes indexables listos. Una traducción pendiente permanece fuera del sitemap/alternates y con política explícita; no publicar como equivalente una síntesis del artículo. Si se lanza por lotes, el pendiente bilingüe continúa abierto.
- Elegir una fuente de generación para evitar desajustes; Google permite hreflang en HTML o sitemap, sin exigir duplicar mecanismos: [versiones localizadas](https://developers.google.com/search/docs/specialty/international/localized-versions).

### D. Integración SEO en la aplicación existente

- Integrar el diseño en Next.js respetando naming, TypeScript estricto y componentes existentes. Servir contenido principal y metadatos coherentes desde la respuesta inicial; la primera vista visual actual no equivale a toda la página renderizada en servidor. Google puede renderizar JavaScript; la elección de servidor aquí busca estabilidad y rendimiento, no afirmar que JS sea invisible: [SEO con JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- Reutilizar `site-config`, `buildMetadata`, `structured-data.tsx` y `structured-graph.ts`. Mantener una entidad con `@id` estable, datos reales y relaciones claras; Organization/ProfessionalService, WebSite, Service, Article/BlogPosting y BreadcrumbList cuando correspondan. No crear entidades locales duplicadas ni inventar ratings/direcciones.
- Corregir descripciones genéricas empezando por páginas indexables comerciales/editoriales. Title útil y propio por intención; no forzar diferencias artificiales en nombres de casos ES/EN. Google puede reescribir [títulos](https://developers.google.com/search/docs/appearance/title-link) y [snippets](https://developers.google.com/search/docs/appearance/snippet); no hay garantía de mostrar el texto exacto.
- Un H1 en fuente y DOM, introducción y H2/H3 semánticos conforme al playbook interno. Es una convención de PixelTEC: no afirmar una penalización automática de Google por dos H1. Imágenes con dimensiones, variantes adaptables y alt descriptivo; decorativas con alt vacío.
- Preservar `src/app/sitemap.ts` dinámico y publicaciones del CMS. Incluir solo URLs canónicas indexables con traducción lista y lastmod real. No convertirlo en lista estática de 144 páginas ni actualizar fechas por cada build. Google ignora priority/changefreq: [sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- Mantener noindex y exclusión de `/login`, `/portal`, `/reset-password`, `/p/*`. `/metodologia` y `/guias-transformacion` ya están excluidas por política del producto: reconsiderar solo cuando tengan contenido suficiente y decisión registrada. Una ruta desconocida devuelve 404 real, no plantilla vacía con 200.
- Separar local/staging/producción. Localhost actual no está publicado; un staging público requiere protección de acceso apropiada. Disallow impide que Google lea noindex: no usar esa combinación como garantía de desindexación o privacidad. Al publicar, validar que páginas comerciales sean rastreables y sin noindex, conservando exclusiones deliberadas: [bloquear indexación](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- Preservar formularios, diagnóstico conectado, CMS, portal, autenticación, RBAC, auditoría y contratos de API. Schema de validación en la frontera y pruebas de negocio críticas obligatorias; no sustituir funciones reales por demostraciones locales. Las pruebas con efectos reales a terceros necesitan alcance autorizado.

### E. Experiencia y rendimiento

Medir el build de producción final en inicio ES/EN y muestras por plantilla: servicio, industria, caso, artículo largo, landing local y conversión. Fijar versión de herramientas/dispositivo/red y ejecutar tres cargas frías secuenciales por perfil; reportar mediana, rango y peor resultado, sin mezclar builds ni usar una prueba favorable aislada.

Objetivo de campo: LCP ≤2.5 s, INP ≤200 ms y CLS ≤0.1 en percentil 75, separado por móvil/escritorio. Lighthouse es diagnóstico de laboratorio; TBT no sustituye INP. Si faltan datos, registrar esa limitación y usar medición real instrumentada respetando privacidad: [Core Web Vitals](https://web.dev/articles/vitals).

Perfilar el trabajo inicial del cubo/runtime antes de optimizar, precargar solo recursos críticos, diferir lo no visible, conservar caché/compresión y eliminar duplicaciones. Establecer presupuestos por plantilla contra baseline controlado. No eliminar el diseño, cubo o efectos por una puntuación sin diagnóstico.

Validar 320/390/768/1024/1280 px, teclado/foco, menú, formularios, contraste, lectura, movimiento reducido, selector de idioma, historial y navegadores principales. Mantener transiciones progresivas y enlaces normales; contenido y CTA deben seguir disponibles sin animación y sin interacción previa para cargarse.

## 4. Actualizaciones de Google que cambian las prioridades

- Google retiró los resultados enriquecidos de FAQ desde el 7 de mayo de 2026. Conservar preguntas útiles visibles; no invertir en FAQPage con la promesa de ese resultado. El marcado heredado se revisará por compatibilidad, sin borrado automático como parte de este plan: [actualizaciones oficiales](https://developers.google.com/search/updates).
- AI Overviews/AI Mode mantienen fundamentos SEO; no requieren un archivo especial ni schema exclusivo. Priorizar experiencia propia, casos documentados y respuestas útiles: [funciones de IA](https://developers.google.com/search/docs/appearance/ai-features) y [guía de optimización](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
- Datos estructurados válidos no garantizan resultados enriquecidos; un tipo Service no implica una presentación especial. Los testimonios propios no justifican estrellas autorreferentes de Organization/LocalBusiness: [políticas](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) y [reseñas](https://developers.google.com/search/docs/appearance/structured-data/review-snippet).
- No aumentar contenido por alcanzar un número de palabras. La información debe resolver la necesidad con experiencia y evidencia: [contenido útil](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). Para presencia local, comprobar datos reales del negocio; no crear oficinas ficticias: [Google Business Profile](https://support.google.com/business/answer/7091).

## 5. Backlog inicial verificable

| ID | Prioridad | Entrega | Evidencia que cierra el pendiente |
|---|---|---|---|
| SEO-R01 | P0 | Inventario ampliado y baseline | Matriz reconciliada + exportaciones con fecha/host y ausencias declaradas |
| SEO-R02 | P0 | Política URL/indexación por entorno | Matriz expected/actual de status, canonical, robots y redirects |
| SEO-R03 | P0 | Paridad de contenido ES y legales | Comparación de secciones/listas/tablas/herramientas y revisión de Miguel |
| SEO-R04 | P1 | Paridad editorial EN | Registro de traducciones revisadas; alternates solo listos |
| SEO-R05 | P0 | Integración inicial/DOM | Crawl comparado por plantilla y todas las URLs; contenido principal sin pérdida |
| SEO-R06 | P1 | Metadata y outline | Reporte por URL; genéricos resueltos en páginas indexables; un H1 |
| SEO-R07 | P0 | CMS, sitemap y exclusiones | Publicación de prueba controlada reflejada correctamente, privadas ausentes |
| SEO-R08 | P1 | Grafo estructurado | Parseo y entidades correctos; pruebas de tipos admitidos sin errores críticos |
| SEO-R09 | P0 | Conversión y seguridad conservadas | Pruebas de contacto/diagnóstico/auth/autorización y demás flujos críticos afectados |
| SEO-R10 | P1 | Rendimiento y accesibilidad | Serie reproducible + matriz responsive/teclado; pendientes de campo explícitos |
| SEO-R11 | P0 | Release y recuperación | SHA, pruebas finales, configuración revisada, rollback y aprobación de publicación |
| SEO-R12 | P1 | Seguimiento orgánico | Informes día 7/14/28 con cohortes, conversiones y decisiones justificadas |

Orden práctico: R01–R03; después R04–R10 por plantilla; R11 cuando todo lo aplicable pase; R12 tras publicación. Comenzar por inicio → servicios → contacto/diagnóstico → industrias/casos → artículos/locales → resto, ajustado por tráfico/conversiones verificados en A. No se han cerrado estos ítems por haber escrito el plan.

## 6. Puerta de salida: controles antes de publicar

| Control | Evidencia exigida para marcar PASS |
|---|---|
| Continuidad | 100% del inventario conocido con resultado esperado; cero cambios de URL sin decisión |
| Contenido | Fuente aprobada cubierta; sin placeholders, legales autorreferentes o claims no sustentados |
| Idiomas | Traducciones listas, canonical/hreflang recíprocos válidos y selector contextual |
| Rastreo | Enlaces HTML útiles; cero enlaces internos rotos u huérfanos indexables injustificados |
| Respuesta HTTP | Páginas esperadas 200; desconocidas 404; redirects intencionales sin ciclos |
| Indexación | Públicos elegibles rastreables; privados/borradores excluidos; meta y headers coherentes |
| Canonical/sitemap | URLs, protocolo/host/barra y mapa coherentes; sitemap dinámico sin privadas/noindex |
| Render — **FAIL / P0 bloqueante actual** | Portadas ES/EN con 1 H1, 0 H2 y cuerpo dependiente de plantilla cliente. `npm run release:check` debe fallar; cerrar con contenido principal completo inicial y paridad HTML/DOM, no con H2 decorativos |
| Schema | Grafo fiel al contenido visible y validación según tipo; no exigir rich result inexistente |
| Calidad | TypeScript strict, build y pruebas críticas pasan; sin regresiones de flujo o diseño |
| Rendimiento | Medición controlada del candidato y presupuestos acordados cumplidos; campo separado |
| Publicación | Informe ligado a SHA exacto, rollback disponible y autorización humana del candidato |

No declarar PASS con pruebas de otro commit. Detener publicación por noindex/robots equivocados, pérdida de URLs/contenido, fallos de negocio, secretos expuestos, errores críticos de compilación o traducciones incompletas anunciadas como completas. Las pruebas SEO no sustituyen seguridad ni revisión editorial.

## 7. Publicación, monitoreo y siguientes decisiones

Preparar una propuesta de release concreta antes de solicitar autorización: diff, páginas, metadatos, evidencia, impacto y recuperación. Aplicar el procedimiento gobernado existente; no subir el dist del prototipo como sustituto de toda la aplicación. Preservar respaldo de configuración y contenido, evitando restauraciones de datos que destruyan operaciones nuevas.

Tras publicar: smoke inmediato y a las 24/72 horas de rutas críticas, robots, sitemap, headers, canonical, idiomas y conversión. Inspeccionar URLs representativas en Search Console y enviar el sitemap correcto. Revisar día 7/14/28: errores/indexación, consultas y páginas por idioma/host, marca/no marca, dispositivo, leads orgánicos y experiencia real. Esta cadencia es un plan, no una automatización creada hoy.

Escalar o revertir el release ante fallos técnicos atribuibles al cambio (5xx, contenido ausente, bloqueo de indexación general o conversión rota). No decidir rollback por una oscilación de tráfico de 24 horas. Comparar periodos completos equivalentes, separar estacionalidad/campañas y documentar qué explica la evidencia y qué sigue incierto.

El responsable registra cada hallazgo en el backlog existente: causa, cambio, fecha, evidencia y próxima revisión. La investigación reutilizable vive en NeuroPIXEL en `08_REFERENCIA/SEO para rediseños — aprendizajes de Google 2026-10-03.md`; el plan de ejecución permanece con el código. Documentación y GitHub se sincronizan al cerrar cada lote.
