# ¿Qué corrige la revisión del lote SEO?

WO-2026-00504, 2026-10-03, Ingeniería. Corrige controles técnicos, procedencia y cierre documental del prototipo. **La implementación local de estas correcciones está verificada; el release sigue bloqueado.** No cambia el diseño, los slugs ni el contenido aprobado. No publica en producción, modifica GSC ni opera infraestructura de Encino.

## Cambios y pruebas

| Hallazgo | Corrección / evidencia |
|---|---|
| Robots fijo en todas las plantillas | `robotsMeta` deriva del entorno y de `indexPolicy`. Plantillas y portada usan la misma función. Preview: noindex completo. Público: solo candidatos elegibles; 52 EN incompletas y exclusiones siguen noindex. Test del renderer de interiores con fixture para 144 entradas, 86 candidatos; no prueba dist público ni reemplazo de robots del home público. |
| Home dependiente de runtime | `release-check.mjs` registra SHA, H1/H2 y plantilla cliente para ES/EN. Ambas: 1 H1, 0 H2, FAIL. Un H2 decorativo no pasa el control. Next/CMS/flujos y validación final también permanecen bloqueados. |
| Riesgo de generar candidato indexable antes de integrar | `SEO_ENV=public npm run build` falla antes de reemplazar la preview. Regresión verifica fallo y conservación exacta del HTML. `npm run release:check` no puede pasar actualmente: bloqueo NEXT_INTEGRATION y retorno BLOCKED/false incondicionales. |
| Destino Encino desconocido | Corregidos reporte, baseline, mapa e inventario: `https://www.mueblesencino.com`; WO-166/210 documentan migración y 301 históricos. No se certifica respuesta actual ni causa de las 404 históricas. |
| Exportación GSC sin contraste CSV | Comparados ambos ZIP originales: hash, páginas, filtros y sumas de la gráfica coinciden con JSON curado. Evidencia: `gsc-export-verification-2026-10-03.json`. Se mantiene la discrepancia de dispositivos y no se infieren conversiones. |
| Planes y números de WO inconsistentes | Plan maestro enlaza la WO-345 SEO y plan integral **en su commit histórico** `80d8d964`, más PR #139/#141 y baselines del repo. El archivo WO-345 actual es de Hermes; no se confunde con el histórico ni se reescribe. |

`npm run verify`: TypeScript estricto, build, 11/11 pruebas, 145 HTML, 8,170 referencias sin errores, 60 slugs/metadatos preservados, presupuestos de recursos y hash del inicio original PASS. `docs/release-readiness.json` registra el bloqueo separadamente; verify verde no significa release listo.

Portada ES generada: SHA-256 `e61ab4c78f97e23f36a1738e6abef8ee12aafa821a4a9e0071b8c481d0407009`, idéntico al HTML medido anteriormente. No se repitió Lighthouse ni QA visual porque no cambia la salida visible. Las cifras 98/100 y las 72 pruebas SEO/compilación Next son evidencia del lote previo, no ejecuciones nuevas. Sin cambio de schema, autenticación, autorización ni flujos de negocio en esta corrección.

## Alcance explícito de integración de la app raíz

Los tres archivos del lote previo `c7dbc8b` son parte de la **integración propuesta en la rama de diseño**, pendiente de revisión de Miguel antes de merge/deploy:

| Archivo raíz | Motivo e impacto |
|---|---|
| `next.config.ts` | `ignoreBuildErrors:false`: el build falla ante errores TS; coincide con el piso estricto del proyecto y endurece la comprobación de futuros deploys. |
| `src/lib/seo/site-graph.ts` | Extrae identidad/grafo puro para compartirlo con el prototipo sin duplicar datos de negocio. |
| `src/components/seo/structured-data.tsx` | Consume y reexporta el grafo compartido conservando la API existente. |

No se vuelven a modificar en WO-504, no se separan artificialmente del consumidor y no se aprueba su publicación por arrastre. La entrega del prototipo no autoriza merge a main. La futura integración debe conservar CMS/sitemap dinámico y probar contacto, diagnóstico, portal y demás contratos productivos.

## Trazabilidad y límites

El lote anterior se ejecutó sin WorkOrder y con un check-in que aún describía el menú. La evaluación `2026-10-03-pixeltec-mx-codex-01-1` registra cumplimiento parcial, base 13/18, `regla-viva-ignorada` y `checkin-incompleto`. No se modifica esa evaluación ni se crea una aprobación retroactiva. WO-504 registra esta corrección prospectiva con Assignment y check-in de Ingeniería antes de modificar código.

El vault canónico estaba en `83e071b7`, ocho commits detrás de `06b7ed43`; el objeto sí existía localmente. Se resguardaron los cinco archivos propios idénticos al remoto, se avanzó por fast-forward y se verificó conservación byte por byte de los 16 archivos locales y del diff staged preexistente. El resguardo y manifiesto viven fuera del corpus en `work/vault-before-seo-correction`; se conserva además el stash de recuperación. No se copia una publicación remota encima de un HEAD antiguo.

El plan del home citado como `plan-seo-home-2026-09-14.md` no fue localizado en la publicación ni en el historial disponible de esa ruta. No se fabrica un reemplazo. La discrepancia de identidad de WOs históricos queda documentada; resolver globalmente ese registro no es alcance de esta landing.

Consulta canónica por filesystem: MCP NeuroPIXEL respondió `Transport closed`; no se afirma igualdad con la publicación de Console/MCP. La edición anterior del playbook añadió una referencia de investigación solicitada por Miguel, sin cambiar reglas normativas; este lote no modifica el playbook.

## Operación siguiente

1. `npm ci && npm run verify` reconstruye la preview y verifica las correcciones.
2. `npm run release:check` siempre devuelve código 1 en esta versión. Aun corrigiendo HOME_INITIAL_CONTENT, NEXT_INTEGRATION es incondicional y el retorno fija BLOCKED/false. Levantarlo exige modificar `inspectRelease()` para comprobar el candidato integrado y derivar status/productionReady de todos los resultados; no basta quitar el push. Validar PASS/FAIL y separar aprobación humana.
3. Integrar contenido completo inicial y comprobar paridad semántica/funcional; revisar traducciones por lote. Luego adaptar el control al candidato Next real y presentar evidencia + rollback para aprobación humana.

Fuentes oficiales consultadas de nuevo el 2026-10-03: [meta robots por página](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) y [procesamiento de JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics). Google puede renderizar JS; el bloqueo de este prototipo es un control interno de estabilidad y paridad, no una afirmación de penalización por ausencia de H2. Un rastreador necesita acceso para leer noindex; localhost/Disallow no se presentan como mecanismo de privacidad o garantía de desindexación.

## Precisiones de la segunda revisión — WO-505

La cobertura pública usa `<h1>Policy fixture</h1>` con el renderer de interiores y entradas del inventario; no un dist público. La entrada `/` tampoco recorre `homeContent` ni el reemplazo `__PAGE_ROBOTS__` de `build.mjs`: esa ruta en modo público **no está ejercitada**. Sí está probado el rechazo previo al build y la conservación del dist preview. No se amplían estas afirmaciones a una integración end-to-end.

El H2 sigue siendo condición ejecutable en `inspectHome`, justificada solo como señal de las secciones semánticas de esta portada. No demuestra paridad ni es regla universal de Google. Al integrar debe contrastarse contenido aprobado, no solo conteos. [README: cambio de código requerido y límites](../README.md#precisión-del-control-y-de-las-pruebas--wo-505). No hay aceptación de Miguel de un bloqueo permanente.

Se añade a `gsc-export-verification-2026-10-03.json` el SHA-256 calculado de `gsc-404-2026-10-03.zip`, separado de los dos cruces de rendimiento: acredita identidad del archivo, no una nueva conciliación de sus filas ni causalidad de errores.

Instrucción recibida de Miguel en esta revisión: publicación documental mediante clon separado, push y `merge --ff-only`; no operar stash ni update-index del vault compartido con sesiones en progreso. Los dos stashes previos se conservan para su decisión. Ante rechazo de alcance por hook, detener y reportar; no ampliar resource_keys del propio WO para pasar. Las evaluaciones previas se conservan como historia: el estado sincronizado posterior no borra una incidencia anterior. Veredictos, PR/separación de archivos y permanencia del control siguen pendientes de decisión humana.
