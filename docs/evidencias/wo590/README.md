# ¿Qué acredita la evidencia del primer lote de WO590?

El lote acredita una auditoría HTTP productiva, la corrección local del lector CSV y el paso del identificador existente al formulario de seguimiento; **no** acredita publicación, mejora de posicionamiento ni el cierre del plan SEO. Investigación del 14/10/2026 (algunos recibos están fechados en UTC del 15/10). [Baseline](../../seo/baseline-2026-10-14.md), [piloto propuesto](../../seo/piloto-editorial-2026-10-14.md) y [conversiones](../../seo/conversiones-2026-10-14.md).

| Archivo en `l0/` | Qué acredita | Límite |
|---|---|---|
| `production-crawl.json` | Auditor existente: 135 páginas y resultado por URL | HTML inicial de producción, no DOM de Google ni candidato local |
| `inventory.json` | Sitemap, indexabilidad, metadatos y referencias dentro de la muestra | No exhaustivo para hosts, parámetros o históricos |
| `public-contracts.json` | robots/sitemap y protección observada de acceso/clientes | No auditoría de autorización autenticada |
| `public-metadata-and-redirects.json` | Cinco muestras OG/iconos y seis variantes/redirects | No cobertura exhaustiva; `http://www` tiene dos saltos |
| `release-observation.json` | Tag, ID inmutable y estado de la imagen productiva | Release distinta de la base local; sin deploy |
| `gsc-comparison-summary.json` | Exportación comparativa con filtros/fechas y hash del ZIP | Sin consultas crudas, cruce consulta × página ni 90 días |
| `bahia-inspection.json` | Inspección individual y comprobación HTTP | Prueba publicada iniciada; resultado no recuperado; sin solicitud de indexación |
| `psi-api-probe.json` | API pública devolvió cuota agotada | No contiene resultados de Lighthouse |
| `browser-dependency.json` | Autorización humana y bloqueo efectivo persistente | No se eludió por otras superficies o conectores |
| `csv-parser-regression.json` | Fallo previo y reproducción posterior sobre el mismo origen | CSV comparativo normalizado por periodo, no soporte directo de esa cabecera |
| `application-tests.json` | 2.321 pruebas de aplicación aprobadas | No sustituye pruebas de navegador o rendimiento |
| `script-tests.json` | 24 pruebas de dos archivos de scripts aprobadas antes de integrar el glob | Ejecución complementaria inicial |
| `integrated-tests.json` | 2.347 pruebas en 188 archivos con la configuración habitual final | Incluye aplicación y scripts SEO |
| `lead-attribution-regression.json` | Omisión reproducida y seis casos simulados aprobados tras el cambio | No prueba un lead o notificaciones de producción |
| `validation.json` | Comandos, compilación y límites del candidato local | No entorno de QA conectado ni release publicada |

## Reproducción y privacidad

```bash
node scripts/public-site/audit-seo.mjs https://pixeltec.mx /tmp/wo590-production.json
npm run typecheck
npm test
npm run build
```

Instalar dependencias con los lockfiles existentes, incluidas las de `design/landingpagepixel2.0` que necesita el auditor. La compilación requiere acceso a Google Fonts; no se cambiaron las fuentes para obtener verde. Tras detectar que los scripts quedaban fuera del glob original, se añadió `scripts/seo/**/*.test.ts` a `vitest.config.ts`. La ejecución integrada final usa `npm test`; conserva entorno y alias existentes. Para repetir solo las regresiones: `npm test -- scripts/seo/gsc-weekly-report.test.ts`.

La regresión se reproduce en `scripts/seo/gsc-weekly-report.test.ts`: multilinea LF; CRLF + BOM + punto y coma + comillas escapadas; celda sin cierre. Las tres fallaron antes del cambio y pasan después, junto con las 13 existentes de ese archivo. No se rebajaron expectativas ni umbrales.

El ZIP GSC y los CSV normalizados permanecen en almacenamiento privado, fuera de Git. Se validaron cabeceras, fechas y columnas antes de separar los dos periodos mediante un lector CSV que respeta comillas. El CLI existente procesa cada agregado con fecha de fin del periodo. No se versionan consultas, correos privados, tokens, variables de entorno ni el reporte semanal individual; el rastreo conserva información que ya es pública en el sitio.

## Publicación y recuperación

`push-candidato`, merge y publicación de producto siguen pendientes. La aprobación de reparación/push documental de WRITE_ROOT pertenece a otro alcance. Se debe obtener un gate concreto con el commit revisable; no trasladar aprobaciones de WOs anteriores.

Para descartar las correcciones tras una integración aprobada, revertir el commit del lote y ejecutar las pruebas afectadas; no hay migraciones ni cambios CMS/DB que deshacer. La documentación distingue hechos de propuestas y conserva las exclusiones actuales. El check-out operativo debe registrar el hash local, la verificación de alcance y las dependencias de Google sin declarar terminado WO590.
