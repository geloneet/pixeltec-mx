# Armazón visual de Pixeltec.mx

Prototipo local de diseño, 2026-10-02. La fuente visual principal es el inicio entregado por Miguel (`src/home.dc.html`, preservado byte a byte). Befox es una referencia secundaria para la estructura de interiores; no se ha importado su código, imágenes o plantilla.

## Abrir y continuar

```sh
npm ci
npm run verify
npm run preview
```

Inicio: http://127.0.0.1:4317/ · Mapa: http://127.0.0.1:4317/mapa/

El servidor escucha solo en localhost. `dist/` también funciona servido por un servidor HTTP estático con soporte de directorios; no abrir por `file://` porque el cubo usa módulos. El servidor incluido responde con la plantilla 404 y status 404 a rutas desconocidas.

## Alcance

72 páginas navegables. Las 60 URLs observadas en el sitemap público de Pixeltec.mx tienen representación visual, con plantillas compartidas para servicios, industria, landings locales, guías y artículos. Se agregan catálogo/casos de proyectos y superficies públicas de metodología, acceso, recuperación y mapa. `docs/routes.json` inventaría cada ruta. No se trabaja sobre CRM, portal privado, tokens de propuestas/contratos ni cuestionarios de clientes.

Se conserva el inicio, su cubo, física, tipografía y composición. El build conecta su navegación a las páginas interiores y añade enlaces de exploración al pie. `public/support.js` y `public/cubo.js` son los recursos originales del usuario. Los interiores adoptan la cabecera crema, CTA azul, logo, negro/blanco, Bricolage Grotesque, geometría y numeración del inicio. Las ilustraciones nuevas son esquemas CSS, no capturas de sistemas reales.

- `src/templates.ts`: componentes de cabecera, pie, arte y plantillas.
- `src/catalog.ts`: rutas y contenido provisional tipado.
- `src/client.ts`: menú accesible, filtros, búsqueda y diagnóstico de cuatro pasos.
- `public/shell.css`: tokens, retícula y responsive de interiores.
- `build.mjs`: render estático y conexión no destructiva de la portada.
- `verify.mjs`: cobertura sitemap, referencias internas, assets, anclas y noindex.

El contenido es provisional. No se valida aquí la veracidad del copy comercial del inicio. Los formularios y el acceso son exclusivamente demostrativos: no hay autenticación, API, persistencia ni envío; los estados lo indican explícitamente. El diagnóstico permite avanzar, volver, resumir y reiniciar. Las rutas y el contenido de la web real no se modificaron.

## Validación

`npm run verify`: TypeScript strict sin errores, 73 archivos HTML (72 rutas más fallback 404), 3,637 referencias locales sin destinos o anclas faltantes y 60/60 URLs del sitemap cubiertas. HTTP 200 en las 72 rutas, registro en `docs/verification.json`.

Navegador real: portada y cubo renderizados; navegación a servicios; abrir/cerrar menú; filtro de proyectos; búsqueda y estado vacío de blog; formulario de contacto con confirmación de simulación; diagnóstico hasta resumen sin envío. Consola consultada sin errores. Sin desbordamiento horizontal en 8 plantillas a 320, 768 y 1440 px (`docs/responsive-checks.json`) y 12 rutas representativas a 390 px tras corregir diagnóstico. Capturas manuales de portada, interiores y móvil revisadas. No equivale a una auditoría de producción o certificación de accesibilidad completa.

## Límites y siguiente etapa

- El runtime heredado del inicio depende de React/Babel/Matter/Lenis/Three y fuentes desde CDNs; los interiores solo necesitan su CSS/JS y fuentes. Conservarlo evita reconstruir el trabajo del usuario en esta fase.
- Contenido, imágenes finales, copy legal, datos de proyectos, SEO productivo y backend quedan pendientes por alcance explícito.
- El HTML está en `noindex,nofollow`; no desplegar como reemplazo del sitio productivo.
- La integración futura a Next.js requiere migrar componentes conservando contratos y funcionalidad del sitio existente. Este prototipo no decide cambiar el stack del producto.
- La propuesta visual espera revisión de Miguel; solo se versiona en rama de diseño.

Fuentes: inicio local de Miguel; https://pixeltec.mx/sitemap.xml consultado el 2026-10-02 (copia en docs); https://befox.preoit.com/ y sus interiores (estructura/CSS; el preloader impidió revisión visual completa en navegador); ficha y seguimiento canónicos de Pixeltec.mx en NeuroPIXEL. El MCP devolvió `Continuidad obsoleta: 09_SEGUIMIENTO/workorders/WO-2026-00221.md` para context_package/source_status; se usaron lecturas directas y no se alteró ese expediente.
