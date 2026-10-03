# Decisión local 001: extender el diseño existente como prototipo aislado

Fecha: 2026-10-02. Alcance: únicamente el armazón visual solicitado por Miguel. No sustituye ADRs de NeuroPIXEL ni autoriza despliegue.

Miguel pidió completar las páginas tomando como base el inicio que ya construyó y usando Befox solo como referencia para dudas. El inicio es una exportación DC con HTML, estilos y runtime propio. Rehacerlo con otra plantilla o iniciar una migración productiva contradice el alcance.

Se conserva la exportación original y se generan interiores estáticos a partir de componentes y catálogos TypeScript strict. Los tokens se derivan del inicio: Bricolage Grotesque, negro/blanco/crema, azul #1466ff, cabecera crema, títulos grandes y esquemas modulares. La propuesta de negro/blanco corresponde a la instrucción explícita del usuario; no cambia la identidad de otros productos ni las reglas canónicas.

La desviación temporal respecto al stack Next.js de ADR-0001 y a la implementación visual Tailwind/shadcn de ADR-0003 queda confinada a `design/landingpagepixel2.0`, sin modificar rutas de aplicación, bases de datos o autenticación. No es una nueva elección de stack: sirve para revisar el diseño antes de integrarlo. El coste declarado es mantener el runtime de exportación y luego migrar sus interacciones a componentes de producción.

No se agrega backend de demostración. Contacto, newsletter y acceso muestran confirmación de vista previa; el diagnóstico conserva selecciones solo en memoria de la página. El usuario autorizó contenido provisional: no se inventan nuevas métricas comerciales ni perfiles reales de equipo.

Validación y operación: [README](../README.md). Inventario de rutas: [routes.json](routes.json).

## Extensión autorizada · 2026-10-03

Miguel pidió optimización tras revisar la auditoría. Se permite añadir bundling y conversión de recursos en build, autohospedar las mismas versiones y adaptar el renderizador manteniendo el diseño. `src/home.dc.html` continúa idéntico; los cambios se aplican en la salida. Esbuild y Sharp son herramientas del prototipo, no una decisión de migración del stack productivo. El servidor de preview representa compresión/caché verificables; hay que reproducirlas al integrar en el hosting definitivo. No se ocultan efectos ni se detecta Lighthouse para mejorar artificialmente la medición.

## Contenido bilingüe autorizado · 2026-10-03

Miguel solicitó incorporar el contenido aprobado de pixeltec.mx, añadir inglés y preservar los slugs por SEO. El snapshot público validado con Zod alimenta el prototipo; datos comerciales y traducciones viven separados de las plantillas. ES conserva URLs y metadatos; EN usa `/en/` con el mismo sufijo, para evitar cambios a URLs existentes. El cambio de idioma conserva contexto. Se sustituyen formularios ficticios por contactos reales y acceso al portal vigente; diagnóstico local con compartir manual. Las guías/artículos EN son resúmenes identificados, y el texto legal oficial sigue en español. No se declara migración SEO concluida, traducción integral ni aprobación de nuevo copy. [Alcance y pruebas](contenido-idiomas-seo-2026-10-03.md).


## Continuidad de navegación autorizada · 2026-10-03

Miguel pidió una sensación de app al cargar. Se conserva la arquitectura de documentos estáticos de este prototipo y sus URLs: mejora progresiva con [View Transitions entre documentos](https://developer.chrome.com/docs/web-platform/view-transitions/cross-document), identidad compartida de cabecera y anticipación limitada de navegación. No se introduce un segundo router que deba desmontar/reiniciar el runtime DC, canvas y listeners en cada cambio. La primera vista de la portada se deriva de su plantilla localizada para evitar una segunda fuente de copy/diseño. Límite: sigue siendo navegación multipágina, y motores sin soporte conservan navegación nativa; integración definitiva en Next.js pendiente. Operación y evidencia en [README](../README.md).
