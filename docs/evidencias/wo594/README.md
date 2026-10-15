# ¿Qué corrige y qué valida el lote de descubrimiento WO594?

El hub `/services/consultoria` ahora enlaza las cuatro landings existentes del registro `CONSULTORIA_CITIES`, incluida Bahía de Banderas. Es el lote hijo secuencial de WO590, autorizado por Miguel «autorizo todo para que ya quede». El estado de publicación y las comprobaciones pendientes se registran por separado: este recibo acredita preparación local, no indexación ni aumento de tráfico.

## Fuente única y generación

El exportador existente `design/landingpagepixel2.0/application-seo.mjs` usa esbuild para leer el registro tipado de la aplicación. Su snapshot público valida ruta/ciudad y conserva el hash del registro. El builder pasa esa cobertura a la plantilla del servicio; el compilador habitual produce el catálogo de Next. No se edita el catálogo a mano ni se crea una segunda lista de ciudades.

La generación base detectó un snapshot anterior del logo: se actualizó al valor canónico ya vigente en `SITE.logoPath`. En 126 entradas cambia ese nodo de schema; no cambian identidad configurada, título, descripción, robots, rutas o texto. El renderer de Next ya filtra la organización compartida de esos grafos por página.

Comparando el candidato con esa generación base, **solo cambia el body de `/services/consultoria`**. La cobertura se presenta con estilos existentes, título descriptivo y cuatro enlaces HTML; no añade oficinas, casos, precios, garantías ni nuevas URL. Las versiones EN conservan su exclusión y su contenido.

## Evidencia y aceptación

| Evidencia | Resultado | Límite |
|---|---|---|
| [generation.json](generation.json) | Fuente, diferencia por página y regresión antes/después | No certifica cómo Google renderiza |
| [tests.json](tests.json) | 2.350 pruebas / 189 archivos, cero fallos u omisiones | Acciones de negocio simuladas |
| [validation.json](validation.json) | TypeScript, build del diseño, compilación y build Next aprobados | **Pendiente veredicto visual** y smoke de navegador |

El manifiesto de WO590 corresponde al corte del commit `31c0ace`; para comprobar sus hashes deben leerse los archivos de ese commit. [manifest.json](manifest.json) recoge los archivos de este lote posterior, incluidas las actualizaciones de baseline y piloto. Los recibos anteriores no son una certificación de revisiones futuras.

La prueba de descubrimiento falló antes del cambio y pasa después. Verifica enlaces descriptivos derivados de las ciudades, destinos ES indexables, contrapartes EN excluidas y logo del schema alineado con la identidad central. La prueba no modifica los pisos estadísticos del módulo SEO.

La navegación directa a `http://localhost:4850` fue rechazada por el permiso del navegador. No se usó otro hostname, navegador, captura indirecta ni CDP para eludirlo. También siguen bloqueados los accesos directos a PageSpeed y Search Console. La autorización escrita de Miguel está registrada; falta que el permiso efectivo permita las comprobaciones. No se pidió indexación.

## Repetición y recuperación

```bash
npm ci
npm ci --prefix design/landingpagepixel2.0
npm run build --prefix design/landingpagepixel2.0
node scripts/public-site/compile-pages.mjs
npm test
npm run typecheck
npm run build
```

Con el navegador habilitado, levantar el candidato en un puerto propio, comprobar el hub y sus enlaces en escritorio, 320/390 y tableta, revisar consola y contrastar el catálogo de destinos con el inventario. No usar DB o proveedores de producción para probar formularios. Tras el despliegue aprobado, repetir el auditor productivo y verificar la release; las mediciones de Google siguen un cierre distinto del cambio técnico.

Rollback propuesto: revertir el commit del lote y regenerar desde su fuente anterior; no hay migraciones, cambios de entorno ni contenido CMS que restaurar. Revertir requiere el procedimiento autorizado, no una edición manual del catálogo.
