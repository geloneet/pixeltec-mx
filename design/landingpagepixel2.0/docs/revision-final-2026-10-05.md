# Revisión técnica y visual del HTML — 2026-10-05

## Resultado y alcance

Reflejo editorial fundido mediante máscara CSS progresiva (incluye WebKit), sin modificar el original. Eliminado el rótulo de prototipo en páginas legales EN y la leyenda genérica de ilustración en detalles de servicio. No se ocultaron resúmenes EN ni se inventaron traducciones legales, cifras o casos.

`npm run verify`: compilación TypeScript, 152 rutas, 14 pruebas, presupuestos y HTML inicial ES/EN. El diagnóstico conserva la paridad exhaustiva de 122,640 combinaciones con la lógica original. Nueva auditoría `quality-audit.mjs` integrada en verify: IDs únicos, dimensiones/alt de imágenes y marcadores de contenido inacabado. Evidencia reproducible: [quality-audit.json](quality-audit.json).

Revisión de navegador local: portada desktop, menú móvil abrir/cerrar, servicios (3 cards, animaciones activas al entrar en pantalla), industrias (5 cards), proyectos y diagnóstico a 390px. Sin overflow en las superficies inspeccionadas; consola sin errores/advertencias en esta sesión. Diagnóstico comprobado con validación vacía y recorrido Hotel → trabajo manual → 6–20 empleados → ahorrar tiempo: 67%, recomendación Automatización. No se envió nada. Captura: `work/portfolio-20261005/editorial-fade-final.png`.

Las imágenes decorativas nuevas usan WebP responsive y lazy loading; editorial 29,686/80,316 bytes (640/1280), metodología 49,630/104,696 bytes (640/1080). No dependencias nuevas. El código de movimiento existente pausa artes fuera de pantalla/documento oculto y respeta reduced-motion; no se alteró la escena 3D para mejorar artificialmente una auditoría.

## Pendientes reales antes de producción

- 46 rutas EN son resúmenes de artículos/guías o remiten a documentos legales españoles. Lista exacta en `quality-audit.json`; siguen excluidas de indexación según política existente. No equivalen a traducción completa.
- `NEXT_INTEGRATION` mantiene bloqueada la publicación: CMS y flujos productivos pendientes; el prototipo no certifica esos sistemas.
- Esta revisión no es una nueva medición Lighthouse ni de Core Web Vitals de usuarios reales. No se declara rendimiento 100 ni ausencia absoluta de errores. Próxima verificación de campo después de un candidato desplegado autorizado.
- Merge de producto a main y conciliación canónica compartida pendientes. Ningún stash ni índice ajeno manipulado.

## Criterios consultados

Google distingue medición de laboratorio y de campo: [Web Vitals](https://web.dev/articles/vitals). Objetivos de referencia p75: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; no medidos en esta ronda. El contenido debe ser útil, fiable y escrito para personas: [Google Search Central](https://developers.google.com/search/docs/fundamentals/creating-helpful-content). Se conserva la procedencia en documentación técnica y se evitan notas internas innecesarias en la interfaz.
