# Armazón visual de Pixeltec.mx

Prototipo local de diseño y contenido, actualizado 2026-10-03. La fuente visual principal es el inicio entregado por Miguel (`src/home.dc.html`, preservado byte a byte). Befox es una referencia secundaria para la estructura de interiores; no se ha importado su código, imágenes o plantilla.

## Estado vigente del trabajo SEO — 2026-10-03

Portadas ES/EN completas en el HTML inicial, con hidratación sobre los mismos nodos y contenido aprobado verificado. [Cierre de HTML y QA visual — WO-506](docs/cierre-html-2026-10-03.md). Once pruebas, compilación estricta, 60 slugs y presupuestos de tamaño conservados. La prueba de portada ahora contrasta el `dist` con textos de servicios, casos, testimonios, metodología y artículos, además de su estructura.

**Ajuste visual — 2026-10-05:** se retiró del H1 el antetítulo «Desde Puerto Vallarta para todo México»; la frase descriptiva principal del hero se conserva.

El [primer lote SEO y GSC](docs/ejecucion-seo-2026-10-03.md) conserva su evidencia histórica. Sus mediciones Lighthouse 98 móvil / 100 escritorio **no corresponden al HTML de WO-506**: no se repitió Lighthouse en este lote. Continúan pendientes Next/CMS, flujos productivos, traducciones largas y revisión editorial. **No es un reemplazo publicable ni SEO certificado al 100%.**

## Abrir y continuar

```sh
npm ci
npm run verify
npm run preview
```

Inicio: http://127.0.0.1:4317/ · Mapa: http://127.0.0.1:4317/mapa/

En el repo, identidad y redirects se derivan del código canónico de la aplicación. La copia autónoma del Desktop usa `docs/application-seo.generated.json`, exportación pública generada con hashes de procedencia; no se edita a mano y se refresca desde el repo antes de un release.

El servidor escucha solo en localhost. `dist/` también funciona servido por un servidor HTTP estático con soporte de directorios; no abrir por `file://` porque el cubo usa módulos. El servidor incluido responde con la plantilla 404 y status 404 a rutas desconocidas.

## Alcance

144 páginas navegables: 72 en español y 72 en inglés. Las 60 URLs observadas en el sitemap público de Pixeltec.mx tienen representación visual, con plantillas compartidas para servicios, industria, landings locales, guías y artículos. Se agregan catálogo/casos de proyectos y superficies públicas de metodología, acceso, recuperación y mapa. `docs/routes.json` inventaría cada ruta. No se trabaja sobre CRM, portal privado, tokens de propuestas/contratos ni cuestionarios de clientes.

Se conserva el inicio, su cubo, física, tipografía y composición. El build conecta su navegación a las páginas interiores y añade enlaces de exploración al pie y hooks de movimiento a la copia generada. `public/support.js` conserva el runtime original; `public/cubo.js` es su versión optimizada, con el mismo diseño. Los archivos originales del Desktop permanecen intactos. Los interiores adoptan la cabecera crema, CTA azul, logo, negro/blanco, Bricolage Grotesque, geometría y numeración del inicio. Las ilustraciones nuevas son esquemas CSS, no capturas de sistemas reales.

- `src/templates.ts`: componentes de cabecera, pie, arte y plantillas.
- `src/content.ts`, `src/guides.ts`, `src/i18n.ts`: contenido comercial bilingüe y rutas.
- `src/home-content.ts`: adapta contenido en la copia generada del inicio, sin cambiar su fuente.
- `source-content.mjs`: valida con Zod el snapshot público antes de renderizar texto seguro.
- `src/art.ts`: ilustraciones conceptuales compartidas.
- `src/client.ts`: menú accesible, filtros, búsqueda y diagnóstico de cuatro pasos.
- `public/shell.css`: tokens, retícula y responsive de interiores.
- `build.mjs`: render estático y conexión no destructiva de la portada.
- `verify.mjs`: cobertura sitemap, referencias internas, assets, anclas y noindex.

El contenido comercial procede de las 60 páginas públicas consultadas el 2026-10-03, que Miguel señaló como aprobadas. Las traducciones y adaptación editorial nuevas esperan su revisión. Contacto ofrece WhatsApp/correo reales y acceso enlaza al portal vigente. El diagnóstico conserva selecciones en memoria y genera un enlace para compartir manualmente; no envía datos automáticamente. No hay autenticación ni persistencia en el prototipo. Alcance por idioma, fuentes y límites: [contenido y continuidad SEO](docs/contenido-idiomas-seo-2026-10-03.md).

## Validación

`npm run verify`: TypeScript strict sin errores, 145 archivos HTML (144 rutas más fallback 404), 7,457 referencias locales sin destinos o anclas faltantes y 60/60 URLs del sitemap cubiertas. HTTP 200 en las 144 rutas, registro en `docs/verification.json`.

Navegador real: portada y cubo renderizados; navegación a servicios; abrir/cerrar menú; filtro de proyectos; búsqueda y estado vacío de blog; contacto directo sin formulario simulado; diagnóstico hasta resumen sin envío. Consola consultada sin errores. Sin desbordamiento horizontal en 8 plantillas a 320, 768 y 1440 px (`docs/responsive-checks.json`) y 12 rutas representativas a 390 px tras corregir diagnóstico. Capturas manuales de portada, interiores y móvil revisadas. No equivale a una auditoría de producción o certificación de accesibilidad completa.

## Movimiento suave · 2026-10-02

`src/motion.ts` y `public/motion.css` comparten los efectos sin dependencias adicionales. Las entradas usan 18 px / 640 ms con escalonamiento máximo de 165 ms; se reproducen una vez al entrar al viewport. Botones, flechas, subrayados e ilustraciones responden suavemente; los efectos de hover se limitan a ratón/puntero fino. El menú interior abre en 420 ms y cierra en 180 ms, manteniendo Escape y retorno del foco. Filtros solo animan tarjetas que vuelven a aparecer; el diagnóstico anima el paso visible y su progreso.

El contenido es visible por defecto: si falla JavaScript o no existe IntersectionObserver, sigue accesible. La preferencia `prefers-reduced-motion` desactiva los efectos nuevos y los bucles CSS; si cambia durante la sesión se cancelan las animaciones nuevas activas. La navegación por teclado revela inmediatamente su objetivo. En el inicio se espera al montaje del runtime heredado sin intervenir en cubo, física, marquesinas ni sus transforms. Los comportamientos heredados JavaScript conservan sus propias reglas de movimiento.

Verificación adicional: TypeScript/build y enlaces PASS; menú por Escape con retorno de foco, abrir/cerrar en móvil, filtros y avance/retroceso del diagnóstico comprobados; sin overflow en servicios, proyectos y diagnóstico a 390 px. `docs/motion-checks.json` registra alcance y límites. Movimiento reducido revisado en código; la herramienta de navegador no permite emular esa preferencia, por lo que no se declara prueba visual con ella activada.

## Auditoría de rendimiento · 2026-10-03

Inicio auditado sin modificar diseño: mediana Lighthouse 91/100 escritorio y 60/100 móvil (tres ejecuciones por perfil). LCP móvil 7.96 s y TBT 404 ms; rango de puntuación móvil 37–64. Los efectos nuevos no aparecen como cuello de botella principal. Hallazgos, variación, pruebas de atribución, prioridades y reproducción: [rendimiento del inicio](docs/rendimiento-inicio-2026-10-03.md). Datos estructurados en `docs/performance-2026-10-03.json`. Esta medición local no certifica producción ni un teléfono real.

## Optimización del inicio · 2026-10-03

`optimize.mjs` procesa solo la copia generada: crea dos bundles locales (React/runtime y física/scroll), elimina la segunda descarga del HTML, incorpora CSS crítico y precarga las tres tipografías visibles del inicio. Esbuild empaqueta Three con eliminación de código no usado. El cubo espera a que el navegador tenga oportunidad de pintar el contenido y a la cercanía del viewport; conserva interacción, materiales, iluminación, física y efectos. La geometría redondeada baja de 20 a 12 subdivisiones por eje y deja de preservar el buffer WebGL. No hay ramas por Lighthouse o agente de usuario, ni se retira el cubo para medir.

Sharp genera WebP transparentes de 360/720 px desde el PNG original, con srcset/sizes, dimensiones reservadas, decoding async y loading lazy. Las fuentes locales conservan sus licencias en `public/fonts/`; los paquetes en `dist/licenses/`. `public/home.css` corrige el espacio del logo en móvil sin cambiar la cabecera de escritorio.

El build emite archivos `.br` y `.gz`. El servidor incluido negocia Brotli/gzip, maneja HEAD, ETag/304 y revalida para evitar que un rebuild muestre assets antiguos. Al usar otro hosting hay que configurar compresión, MIME y caché equivalentes: copiar `.br` por sí solo no activa la compresión. No se ha cambiado el servidor de pixeltec.mx.

`npm ci && npm run verify` reproduce el build offline una vez instalados los paquetes: TypeScript strict, rutas/referencias, pruebas reales HTTP de compresión/caché/límites de archivos y presupuestos de peso. `performance-budget.mjs` protege también el SHA del inicio entregado. El runtime original se mantiene por el alcance visual; Lenis 1.1.13 permanece fijado por compatibilidad (npm avisa que su dependencia transitoria tempus fue renombrada; no se carga ese paquete en navegador). El estado de auditoría de npm corresponde al lock, no garantiza vulnerabilidades futuras.

Resultados comparativos, método y límites en [optimización medida](docs/optimizacion-inicio-2026-10-03.md). Las métricas del apartado anterior son la línea base, no el estado optimizado.

## Límites y siguiente etapa

- El inicio conserva el runtime DC, ahora con React/Matter/Lenis/Three locales, versiones fijadas y fuentes WOFF2 locales. Babel no se descarga en el recorrido normal. Las variantes de cubo alternativas del editor heredado (no expuestas en la navegación) aún tienen imports CDN en la fuente original. Los interiores usan también fuentes locales. Migrar el runtime DC a componentes del producto sigue siendo deuda declarada de esta fase.
- Pendientes: revisión editorial de Miguel, traducción integral de guías/artículos, fotografías/capturas finales de casos, integración legal y SEO productivo, backend. Las ilustraciones de casos son conceptuales; los datos comerciales sí proceden del sitio vigente.
- El HTML está en `noindex,nofollow`; no desplegar como reemplazo del sitio productivo.
- La integración futura a Next.js requiere migrar componentes conservando contratos y funcionalidad del sitio existente. Este prototipo no decide cambiar el stack del producto.
- La propuesta visual espera revisión de Miguel; solo se versiona en rama de diseño.

Fuentes: inicio local de Miguel; https://pixeltec.mx/sitemap.xml consultado el 2026-10-02 (copia en docs); https://befox.preoit.com/ y sus interiores (estructura/CSS; el preloader impidió revisión visual completa en navegador); ficha y seguimiento canónicos de Pixeltec.mx en NeuroPIXEL. El MCP devolvió `Continuidad obsoleta: 09_SEGUIMIENTO/workorders/WO-2026-00221.md` para context_package/source_status; se usaron lecturas directas y no se alteró ese expediente.

## Contenido e inglés · 2026-10-03

Selector ES/EN conserva la página equivalente. Español mantiene los 60 slugs, títulos, descripciones y canonical observados; inglés añade `/en/` sin renombrar los slugs. Todas las páginas tienen canonical propio y hreflang recíproco. `seo-localization.test.mjs` comprueba esos contratos, HTTP de las 144 rutas y render seguro. `npm run verify` incluye estas regresiones. El prototipo sigue noindex y no se ha desplegado. No reutilizar robots/noindex en producción: seguir el control de integración documentado.

Verificación del contenido: 20 vistas móviles actuales y pruebas funcionales EN en el reporte de contenido. Lighthouse actual: 100 desktop ES; confirmaciones móviles 86 ES/88 EN, con alta variación registrada y control previo 87 bajo carga actual. No reutilizar el 94 de la serie anterior como medición del HTML nuevo.

## Menú original y correcciones visuales · 2026-10-03

Los seis elementos de pixeltec.mx comparten `src/navigation.ts`: Inicio, Nosotros, Servicios, Industrias, Blog y Contacto. Se aplican a inicio/interiores y ES/EN; las páginas Proyectos siguen disponibles como navegación secundaria. Corregidos los laterales negros de la cabecera interior, la ilustración recortada de Nosotros y el contraste del idioma en el menú oscuro. [Cambios, fuente, operación y validación en 36 vistas](docs/menu-original-correcciones-2026-10-03.md). Verificación vigente: 145 HTML, 8,178 referencias, 144 rutas HTTP 200, 60 slugs conservados. Las métricas anteriores corresponden a su etapa histórica.

Ajuste posterior de Miguel, 2026-10-03: quitar Inicio y Blog **solo del menú**. Cabecera/desplegable muestran Nosotros, Servicios, Industrias y Contacto, con equivalentes EN. Páginas, slugs, logo hacia inicio y enlaces del pie permanecen. `primaryNavigation` filtra la lista pública; `footerNavigationItems` conserva sus seis entradas.


### Consistencia visual — 2026-10-03

Pasada autorizada por Miguel sobre la línea visual de su inicio: cubo de marca compartido en `src/brand.ts`, misma escala de cabecera móvil y panel lateral compacto; etiquetas con la fuente monoespaciada local, neutrales cálidos, botones y ritmo entre hero/contenido unificados. Contacto conserva la columna de acciones en tablet (antes heredaba un grid de la ilustración); proceso en una columna en móvil y cierre de página adaptable. Cambios en la copia generada; `src/home.dc.html` idéntico por SHA, sin nuevas dependencias, rutas o cambios de contenido.

Reproducir con `npm run verify` y `npm run preview`. Validación: TypeScript estricto/build, 5 pruebas, 144 rutas HTTP 200, 7,598 referencias, presupuestos y hash PASS. `docs/visual-consistency-checks-2026-10-03.json` registra geometría de 10 páginas en 320/390/768/1024/1280 px: sin overflow de documento ni títulos. Revisadas capturas de inicio, servicios, contacto tablet y menú EN móvil; Escape devuelve el foco. No equivale a una auditoría exhaustiva de accesibilidad o rendimiento. Menú mantiene cuatro elementos; slugs, pie y contenidos conservados. Sin deploy.


### Carga y navegación continua — 2026-10-03

Miguel pidió que la carga se sienta como una app. La portada ES/EN ahora entrega una primera vista real (cabecera, título, descripción y enlaces) derivada del HTML localizado antes de iniciar React; se retira únicamente cuando el renderizador ha montado cabecera y título. No se modifica la exportación original ni se añade una espera artificial. El cubo y la física siguen arrancando progresivamente.

`public/navigation.css` habilita View Transitions entre documentos: cabecera con identidad compartida, transición breve de contenido y respuesta de carga discreta. `src/app-navigation.ts` anticipa hasta seis documentos públicos al mantener puntero/foco; respeta ahorro de datos, excluye rutas de acceso/API, enlaces externos, descargas y clics modificados. No intercepta enlaces, no inserta HTML descargado, no reemplaza el historial ni convierte el prototipo en SPA. Conserva recargas nativas; en navegadores sin la API la navegación funciona sin transición. Movimiento reducido desactiva la transición. La restauración del navegador conserva su comportamiento nativo; no se promete persistencia de formularios tras una recarga.

Validación final: `npm run verify` PASS (6 pruebas, 144 rutas HTTP 200, 7,906 referencias, presupuestos de los nuevos recursos y SHA del original). Regresión de primera vista: títulos ES/EN idénticos a la plantilla, enlaces reales y ausencia de interpolaciones sin resolver. Navegador: inicio→servicios→inicio, historial, idioma, drawer EN y Escape/foco; `data-route-transition=complete` confirmado hacia interiores e inicio. A 320 px: sin overflow, primera vista retirada y un único H1. Se manejan transiciones canceladas sin bloquear el recorrido. No es una nueva medición Lighthouse ni prueba de todos los motores; sin deploy. Reproducir con `npm run preview`, entrar por `/`, navegar por enlaces y volver con el historial.


### Plan maestro SEO — 2026-10-03

[Plan de ejecución y criterios de salida](docs/plan-maestro-seo-2026-10-03.md): continuidad de URLs, información ES/EN, integración con SEO/CMS existentes, conversión, rendimiento y publicación verificable. Investigación oficial de Google y revisión del estado del prototipo; esta entrega solo documenta, sin implementar ni desplegar. No confundir preparación técnica completa con garantía de ranking o indexación. Aprendizajes reutilizables publicados en NeuroPIXEL; pendientes y evidencia permanecen separados de las mediciones históricas.

### Corrección tras revisión — WO-2026-00504

`npm run verify` valida el prototipo y genera `docs/release-readiness.json`; no concede aprobación para publicar. `npm run release:check` **no puede pasar por diseño en esta versión**: `inspectRelease()` añade `NEXT_INTEGRATION` sin condición y devuelve siempre `productionReady:false` y `status:"BLOCKED"`. Corregir la portada, añadir H2 o cambiar una variable de entorno no lo habilita. `SEO_ENV=public npm run build` también se detiene antes de reemplazar `dist`. La política compartida emite meta robots por entorno/página; preview sigue completamente noindex y las 52 EN incompletas conservan exclusión individual en modo público.

[Informe de cambios y conciliación histórica](docs/correcciones-revision-seo-2026-10-03.md). En WO-504 el inicio completo y Next/CMS/conversión eran bloqueos explícitos. WO-506 resuelve el primero; la integración sigue pendiente y esta entrega no es un release productivo.

#### Precisión del control y de las pruebas — WO-505

Para levantar ese bloqueo hace falta un cambio revisado de **código** en `release-check.mjs`: sustituir el `blockers.push('NEXT_INTEGRATION: …')` incondicional por comprobaciones verificables del candidato Next integrado (CMS, flujos y paridad), y derivar `productionReady` y `status` del resultado real de todos los controles. Quitar solamente el `push` tampoco basta por los valores fijos del retorno. Después deben probarse los caminos PASS/FAIL y comprobar HTML/headers/robots/sitemap del candidato público completo. La aprobación humana de publicación continúa siendo independiente. La precisión WO-505 documentó el mecanismo; WO-506 resuelve el contenido inicial, pero conserva NEXT_INTEGRATION y no aprueba el bloqueo como política permanente.

En WO-505, `inspectHome()` exigía un H1, al menos un H2 y ausencia de plantilla inerte. WO-506 lo sustituye por controles de secciones y mínimos de contenido, respaldados por regresión de paridad con los textos aprobados en `dist`. La plantilla inerte permanece como datos de hidratación y ya no es motivo de fallo cuando el contenido completo está presente. Los siete H2 son una señal de la estructura de esta portada, no una regla universal ni garantía SEO. La permanencia del bloqueo global sigue pendiente de Miguel.

La prueba pública llama `renderer(locale, 'public').document(page)` con el cuerpo sintético `<h1>Policy fixture</h1>` para las 144 entradas del inventario: **no genera ni inspecciona un `dist` público**. Incluso la entrada `/` usa ese renderer de interiores. Su comparación con `robotsMeta('/')` comprueba la función compartida, **no ejercita el reemplazo `__PAGE_ROBOTS__` de la portada en modo público**. El intento de build público se detiene antes de llegar a ese reemplazo. Las pruebas sobre `dist` corresponden a preview; sigue pendiente cubrir el build público real cuando exista un candidato integrado.

## Portafolio visual — WO-2026-00508 (2026-10-05)

DALK sustituye a Barro Stock únicamente en los cinco destacados del inicio. El catálogo conserva Barro Stock y sus rutas, y suma DALK, Velank, Transportes Sánchez JR y Subsify: nueve proyectos. Subsify tiene filtro Apps y seis capturas por idioma. Las siete capturas web y doce de la app se sirven como 38 variantes WebP responsive; procedencia, SHA-256 y tamaños en `docs/portfolio-assets-2026-10-05.json`. El retrato nuevo se aplica solo a Nosotros.

Verificado: TypeScript/build, 11/11 tests, 152 rutas, 60 slugs preservados, 8,754 referencias locales, presupuestos de rendimiento y fuente original del diseño. Navegador: destacados, enlace Ver todos, filtro Apps y ficha Subsify ES/EN; móvil 390px sin desbordamiento horizontal. No es una nueva medición Lighthouse.

Pipas Tondoroque mantiene su representación conceptual: no se recibió captura suya y Transportes Sánchez JR es otro proyecto. No se inventaron testimonios ni publicación de Subsify en tiendas. Release continúa BLOCKED exclusivamente por NEXT_INTEGRATION; sin deploy ni integración Next/CMS en este lote.

Ajuste solicitado el 2026-10-05: Subsify sustituye a Pipas Tondoroque en el segundo destacado del inicio ES/EN, usando tres capturas verticales y etiqueta Apps. Pipas conserva ficha y catálogo.

## Diagnóstico inline y footer compartido — 2026-10-05

El botón Comenzar abre las cuatro preguntas dentro de la tarjeta del inicio ES/EN; permite regresar, mantiene selecciones y muestra el resumen sin navegar. Compartir en WhatsApp sigue siendo una acción explícita del visitante. No se guardan respuestas ni se envía nada automáticamente. La página /diagnostico/ reutiliza el mismo componente y controlador.

Todas las rutas usan el footer del inicio, extraído a shared-footer.ts con cuatro columnas, marca azul, enlaces localizados y textura CSS ligera. La fuente de diseño original permanece intacta. Verificación: build estricto, suite existente y prueba de footer único en las 152 rutas y estados iniciales del formulario; flujo manual completo, selección obligatoria, retroceso, resumen y reinicio en navegador; 390px sin overflow. No hay deploy; NEXT_INTEGRATION sigue pendiente.

## Evaluación original dentro de la tarjeta — 2026-10-05

El diagnóstico recupera los catálogos de empresa, problemas (selección múltiple), tamaño y prioridad del motor `../../src/lib/diagnostic/logic.ts`. La adaptación pura `src/diagnostic-logic.ts` conserva score, fortalezas, oportunidades, servicios y plazo; Zod Mini valida las respuestas desde los propios catálogos y elimina duplicados antes de calcular. El resultado se presenta en la misma tarjeta ES/EN, con barra porcentual, recomendaciones y respuestas desplegables. Es orientativo: no una auditoría ni un plazo comprometido.

Pruebas: paridad completa con el motor original en 122,640 combinaciones, entradas inválidas y duplicados; npm run verify 14/14. Caso manual: logística, trabajo manual + Excel, 6–20 empleados y automatizar = 59%, automatización IA + dashboard, 4–6 semanas. Móvil 390px sin overflow. El visitante comparte voluntariamente por WhatsApp; no se solicita contacto, guarda lead ni se llama al backend productivo. Esa integración sigue pendiente para Next/CMS.

Presupuesto documentado: el HTML inicial incorpora 30 opciones y el resultado accesible; ES mide 30,628 bytes Brotli (628 bytes sobre el límite previo). El límite ES/EN pasa de 30KB a 32KB por este alcance adicional; el nuevo controlador completo queda en 8,893 bytes Brotli, con límite separado de 22KB. Se retiró del HTML generado el renderer canvas del footer, ya sustituido por textura CSS. Fuente de diseño original intacta.

### Animación de ilustraciones de servicios — 2026-10-05

Las cards `.service-art` animan órbitas, piezas, gráficos y conversación con CSS (transform/opacity), sin dependencias nuevas. El observador compartido de `src/motion.ts` activa solo ilustraciones visibles y pausa al ocultar la pestaña. `prefers-reduced-motion` conserva la composición estática, incluso si cambia durante la sesión. Sin JavaScript las ilustraciones permanecen visibles y quietas. No se anima el texto de servicios ni cambia su geometría.

Segunda dirección visual solicitada por Miguel: órbitas tridimensionales con nodos luminosos, núcleo con volumen, panel con perspectiva y gráficas secuenciales, mensajes progresivos y mosaico con elevación escalonada. Reutiliza la pausa por visibilidad y la alternativa estática; ningún cambio de contenido o dependencias.

2026-10-05: por decisión de Miguel, WhatsAgent deja de ser una card independiente en Servicios ES/EN y se presenta dentro de Automatización con IA. Se conserva /pixelbot/ y su equivalente EN para continuidad de URLs; esta modificación no elimina páginas.

2026-10-05: Industrias usa seis ilustraciones SVG conceptuales específicas (salud, hotel, rutas, agua, comercio y solar), sin métricas ni datos ficticios. industry-art.css se carga solo en el índice ES/EN. Comparte pausa por visibilidad y reduced-motion con Servicios.

2026-10-05, revisión realista solicitada por Miguel: sustituidos los SVG sectoriales por capturas suministradas (Smile More, Villa Nogal, Transportes Sánchez JR, Velank) e imágenes conceptuales generadas con IA para agua y solar, identificadas en sus pies y alt. Nuevos assets WebP 640/1280, srcset, lazy loading, dimensiones reservadas y movimiento de cámara de 18 s con pausa por visibilidad. No se presentan las imágenes generadas como instalaciones de clientes. Originales IA conservados en el directorio generated_images de Codex; derivados servidos dentro del proyecto en public/assets/industries.

La precisión posterior de Miguel sustituye la dirección fotográfica por una colección de seis gráficos 3D modernos: vidrio cobalto, cerámica marfil y metal cepillado. Las imágenes son ilustraciones conceptuales generadas, no casos de clientes; procedencia en docs/industry-art-provenance.json. Los archivos *-3d-640/1280.webp se sirven con proporción 3:2; zoom máximo 2.5%, pausa por visibilidad y alternativa estática. Las capturas de proyectos permanecen en el portafolio.

### Servicios del inicio — WO-508, 2026-10-05

Las portadas ES/EN usan tres gráficos 3D conceptuales en WebP (640/1280 px), carga diferida, proporción reservada y acercamiento suave al pasar el cursor, respetando movimiento reducido. Procedencia: [service-art-provenance.json](docs/service-art-provenance.json). `marketedServices` comparte el catálogo comercial con Servicios: WhatsAgent forma parte de Automatización y conserva su URL histórica. El mínimo estructural de la portada pasa de cuatro a tres servicios por esta decisión de contenido; se mantiene la comprobación de texto aprobado y el bloqueo `NEXT_INTEGRATION`.

Validación: `npm run verify`, 14 pruebas, 152 rutas y presupuesto de rendimiento aprobados. Revisión local de las tres imágenes cargadas y sin desbordamiento en escritorio y 390 px. Evidencia de sesión: `work/portfolio-20261005/home-services-3d.png`. No se repitió Lighthouse ni se publicó a producción.

### Imagen de metodología — WO-508, 2026-10-05

Por petición de Miguel, el retrato y firma de la portada ES/EN se sustituyen por una ilustración 3D conceptual de un cubo modular azul en ensamblaje. Es una imagen estática, optimizada en WebP 640/1080 con carga diferida y espacio reservado; la foto de Nosotros se conserva. Procedencia: [method-art-provenance.json](docs/method-art-provenance.json). `npm run verify`: 14/14, presupuestos y fuente original PASS. Inspección visual local: imagen cargada, sin retrato ni overflow desktop. Evidencia: `work/portfolio-20261005/method-cube.png`. Sin publicación productiva.

### Consolidación de industrias — WO-508, 2026-10-05

Miguel agrupa distribución de agua dentro de logística/transporte: retirada la categoría independiente de catálogo, portada, Industrias y opciones visibles del diagnóstico ES/EN. El valor histórico `agua` sigue aceptado por el evaluador para no romper datos previos; sus reglas originales no cambian. Casos reales conservados. Contador derivado del catálogo (05). Separador de franja cambiado de estrella a dos píxeles azules. Fuente HTML original preservada. `npm run verify` PASS 14/14 y presupuestos; búsqueda del HTML construido sin la etiqueta independiente ES/EN. Evidencia visual: `work/portfolio-20261005/industry-strip-five.png`.

### Gráfico editorial — WO-508, 2026-10-05

El asterisco de Perspectivas en portada ES/EN se sustituye por un gráfico 3D conceptual de cubos de cristal azul y órbitas metálicas, fondo negro, visible también en móvil. Imagen estática WebP 640/1280 con lazy/srcset y proporción reservada. Procedencia: [editorial-art-provenance.json](docs/editorial-art-provenance.json). `npm run verify` PASS 14/14 y presupuestos; revisión visual desktop en work/portfolio-20261005/editorial-cube.png. Sin cambios de rutas ni publicación productiva.

### Revisión final — 2026-10-05

[Informe técnico y límites de publicación](docs/revision-final-2026-10-05.md). Reflejo editorial fundido, revisión de contenido visible y nueva auditoría estática integrada en `verify`. 46 rutas inglesas aún requieren traducción completa/revisión legal; no se declara cierre total ni publicación productiva.

## WhatsApp flotante · 2026-10-05

CTA compartido ES/EN en todas las rutas, incluido 404. Cuatro sugerencias rotativas abren el WhatsApp corporativo con texto preparado; no envían mensajes automáticamente ni simulan respuestas de un agente. Burbuja descartable, enlace utilizable sin JavaScript, animación pausada al interactuar o esconder la pestaña y compatible con movimiento reducido. Implementación local CSS/TypeScript sin dependencias externas. Validación: verify, revisión visual desktop/móvil 390 px, rotación observada y cierre de burbuja. Evidencia: work/portfolio-20261005/whatsapp-float.png.

Ajuste visual 2026-10-05: ícono flotante reutiliza el trazado de WhatsApp del footer, con relleno sólido y sin stroke para evitar contornos dobles.

2026-10-05 — Tarjetas de principios ES/EN con gráficos CSS grises: piezas enlazadas, capas y módulos. Decorativos aria-hidden, sin recursos ni JavaScript adicionales; máscara gradual y escala móvil. verify PASS y revisión visual desktop; evidencia work/portfolio-20261005/about-depth.png.

2026-10-05 — Símbolos de metodología ES/EN animados: pulso, balanceo, giro y avance diagonal. Observer existente pausa fuera de pantalla/pestaña oculta; movimiento reducido desactiva bucles. Sin dependencias nuevas.

2026-10-05 — Contacto ES/EN integra el diagnóstico compartido en un desplegable nativo dentro de la tarjeta. Cuatro preguntas y resultado sin navegación, validación y envío voluntario existentes reutilizados.

2026-10-05 — Métricas de portada sustituidas por beneficios ES/EN: a tu medida, todo conectado y acompañamiento. Sin cifras comerciales nuevas; tipografía adaptada al contenido.

2026-10-05 — Continuidad visual de navegación: header/footer/WhatsApp separados del fundido documental, contenido nuevo entra sobre el anterior sin intervalo vacío. Redes FB/IG/WA igualadas en interiores; footer sin segunda animación de entrada; scrollbar estable. Conserva URLs, historial, SSR y fallback nativo. No es persistencia DOM SPA: navegadores sin View Transitions hacen navegación normal. NEXT_INTEGRATION sigue pendiente.

2026-10-05 — Miguel confirma capacidades full stack del equipo: Ecosistemas Web ES/EN amplía contenido sobre UX/UI, frontend, backend/datos y nube/operación. Sin atribuir certificaciones, proveedores ni métricas no confirmadas.

2026-10-05 — Detalles individuales de automatización, web/apps y consultoría reutilizan arte 3D aprobado de portada, WebP responsive/lazy ES/EN. WhatsAgent conserva su ilustración específica con el tratamiento de animación compartido.

2026-10-05 — Corrección de destello: el reveal diferido ya no oculta contenido inicialmente visible (también en recargas/enlaces directos). Se retira el fundido global entre documentos, manteniendo animación de secciones al desplazarse. No equivale a router SPA.

2026-10-05 — Decisión de Miguel: las tres imágenes 3D de Inicio son las oficiales de Automatización con IA, Desarrollo Web & Apps y Consultoría & Soporte TI. Índice y detalles ES/EN reutilizan los mismos archivos; no sustituir por ilustraciones CSS antiguas.

### Parallax de servicios — 2026-10-05
Las imágenes oficiales de Inicio, Servicios y detalles ES/EN comparten profundidad al scroll en `motion.ts`: desplazamiento máximo 4%, overscan 10%, un frame por evento y solo tarjetas visibles. Sin bucle continuo; respeta movimiento reducido y pausa al ocultar la pestaña. Sin JS conserva la imagen estática. Verificar las tres superficies al cambiar estos selectores.

### Menú lateral — 2026-10-05
Backdrop anima color y blur explícitos al abrir/cerrar; panel conserva su último frame hasta dialog.close() para evitar reaparición al terminar. Cierre interrumpido parte del estilo visible; reduced-motion sigue inmediato.

### Diagnóstico modal — 2026-10-05
CTA compartido de interiores abre dialog nativo con diagnosticWidget existente ES/EN, cuatro pasos y resultado local. Cerrar/Escape/exterior devuelve foco; conserva respuestas al reabrir. Sin JS enlace mantiene ruta independiente. Inicio y Contacto conservan su diagnóstico inline.

### Scroll uniforme — 2026-10-05
`src/smooth-scroll.ts` es el único controlador Lenis para Inicio e interiores, con los parámetros originales de Inicio. Build elimina solo la inicialización duplicada en la copia generada, preservando home.dc.html. Motion importa el controlador y el parallax compartido responde al scroll real. Diálogos usan scroll nativo; movimiento reducido desactiva Lenis; suspende en pestaña oculta y restaura con pageshow.

### Proyectos de Inicio — 2026-10-05
Tarjetas destacadas ES/EN abren dialog con imagen, descripción y alcance del catálogo canónico, más enlace al detalle. Eventos delegados compatibles con montaje DC; cerrar/Escape devuelve foco. Sin JS se conserva navegación normal; no se duplican datos editoriales.

### Transiciones diagnóstico — 2026-10-05
Controlador compartido: salida 140ms, entrada 320ms y altura 360ms, dirección inversa al volver. Bloqueo de avance duplicado durante transición; foco preventScroll. Reduced-motion cambia de inmediato. Se conserva validación y lógica de resultados.

### Contacto modal — 2026-10-05
Contacto ES/EN reemplaza el desplegable por el modal compartido del CTA; una sola instancia del widget, conserva transición, resultado, cierre/Escape y foco. Inicio permanece inline.

### Diagnóstico rectangular — 2026-10-05
Modal compartido de hasta 1080px con opciones en tres columnas, dos en tablet y una en móvil; altura natural limitada al viewport con scroll interno para resultados largos. Selectores exclusivos de diagnóstico preservan popups de proyectos e Inicio inline.
