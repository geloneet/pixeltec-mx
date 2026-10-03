# Rendimiento del inicio · 2026-10-03

**Veredicto: buen resultado de carga en escritorio; móvil necesita optimización antes de publicación.** Se auditó el prototipo local de Miguel con los efectos premium, commit `6df725a3f746bf99d69f27834857bc1898d45346`. No se modificó el diseño ni su código funcional.

## Mediciones

Lighthouse 13.5.0, Chrome headless 154, Mac mini. Tres ejecuciones independientes por perfil, secuenciales, sin auditorías paralelas. Mediana de cada métrica (no una única ejecución representativa de todas):

| Métrica | Escritorio | Móvil simulado |
|---|---:|---:|
| Rendimiento | 91/100 | 60/100 |
| Primer contenido (FCP) | 1.05 s | 3.10 s |
| Contenido principal (LCP) | 1.69 s | 7.96 s |
| Bloqueo de JavaScript (TBT) | 21 ms | 404 ms |
| Cambios de posición (CLS) | 0.005 | 0.012 |
| Speed Index | 1.09 s | 3.28 s |

Escritorio: puntuaciones 91, 91, 93. Móvil: 37, 60, 64; TBT 3,995 / 404 / 273 ms. La primera ejecución móvil tuvo un pico importante; no se descarta ni se atribuye a una causa sin demostrar. LCP móvil permanece entre 7.96 y 8.41 s en las tres ejecuciones. No hubo advertencias de ejecución de Lighthouse.

Configuración móvil: 412×823, DPR 1.75, CPU ×4, RTT 150 ms, throughput 1638.4 Kbps mediante simulación. Escritorio usa preset desktop. Configuración exacta, entorno, resultados y hashes de reportes originales en `performance-2026-10-03.json`.

## Hallazgos y orden de trabajo

1. **Prioridad alta: adelantar el contenido del inicio.** Hay recursos que bloquean el render: support.js, Matter, Lenis y CSS de fuentes. El runtime monta el HTML a través de React y vuelve a solicitar el documento (otros 94.8 KB transferidos). Lighthouse estima aproximadamente 1.6 s de ahorro potencial por recursos bloqueantes en la primera muestra; la estimación no es garantía ni se suma a otras. Preparar el contenido en build, ordenar/diferir los scripts no críticos y simplificar la cadena de carga. Evidencia: `public/support.js:159`, cabecera de `src/home.dc.html`, auditorías render-blocking/network. Babel está soportado por el runtime, pero **no se descargó en estas pruebas**.
2. **Prioridad alta: reducir el coste de arranque del cubo sin perder su identidad.** Three.js transfiere aproximadamente 411 KB entre core/module, además de cubo.js. En móvil hay tareas largas atribuidas a cubo.js y Three. El montaje genera entorno PMREM, materiales físicos y geometrías antes de presentar la escena (`public/cubo.js:74,98,104,119`). Usar una representación inicial ligera y activar/cargar el 3D después del contenido crítico; revisar iluminación/materiales y calidad adaptativa para móvil. Estas son propuestas, no cambios ya hechos.
3. **Prioridad media: optimizar la ilustración inferior.** PNG de 1254×1254, 860,853 bytes (861,048 transferidos), sin loading=lazy y mostrado a 220–360 px CSS. Representa cerca del 49% de los 1.76 MB transferidos en la muestra. Servir variante WebP/AVIF con transparencia, tamaños responsivos y carga diferida. Está fuera del primer viewport: no se afirma que sea el elemento LCP ni se cuantifica ahorro de LCP sin una prueba específica.
4. **Preparar entrega productiva.** El servidor de revisión sirve sin compresión y con Cache-Control: no-store. Evaluar Brotli/gzip y caché de assets versionados al integrar. No extrapolar este resultado a la configuración real de pixeltec.mx.

## Comparaciones de diagnóstico

Se bloquearon recursos solo dentro de ejecuciones independientes de Lighthouse; la página servida y sus archivos permanecieron iguales.

| Variante móvil | Rendimiento | LCP | TBT |
|---|---:|---:|---:|
| Página completa, mediana de 3 | 60 | 7.96 s | 404 ms |
| Sin motion.js y motion.css, 1 muestra | 61 | 7.97 s | 355 ms |
| Sin cubo.js, 1 muestra | 68 | 8.26 s | 77 ms |

**Interpretación:** los efectos nuevos no aparecen como el cuello de botella principal; suman solo 6.5 KB de fuente. Quitar el cubo reduce mucho el bloqueo, pero no resuelve la carga visual tardía. Es una prueba de atribución que elimina un elemento visible, no una solución aceptada ni un ensayo estadístico. Conservar el diseño del inicio sigue siendo requisito.

## Aspectos favorables y límites

CLS bajo en los dos perfiles. El cubo ya limita DPR a 1.25, apaga sombras y evita render cuando queda fuera de pantalla, la pestaña está oculta o termina la actividad (`public/cubo.js:75,251,268`). Partículas y física tienen controles de visibilidad; los nuevos efectos usan opacity/translate y respetan movimiento reducido. El DOM medido tiene 669 elementos. Estas medidas ayudan, pero no compensan la cadena inicial de carga ni certifican fluidez sostenida.

No se midió INP de usuarios reales, FPS sostenidos, batería ni GPU de un teléfono físico. TBT describe bloqueo de carga; no sustituye INP. El cubo WebGL y los materiales pueden comportarse distinto entre GPU, cachés y dispositivos. La comparación es de laboratorio sobre localhost y recursos CDN externos, no una certificación productiva.

Como referencia, Google define buena experiencia de campo con LCP ≤2.5 s, INP ≤200 ms y CLS ≤0.1, evaluados al percentil 75. Esta auditoría no incluye población de usuarios para aprobar Core Web Vitals: https://web.dev/articles/vitals . Método Lighthouse: https://developer.chrome.com/docs/lighthouse/overview .

## Reproducir

Con el preview activo (`npm run preview`):

```sh
npx --yes lighthouse@13.5.0 http://127.0.0.1:4317/ --only-categories=performance --output=json --output=html --output-path=mobile --chrome-flags='--headless' --quiet
```

Repetir tres veces con nombres distintos. Para escritorio añadir `--preset=desktop`. No ejecutar perfiles en paralelo. Diagnóstico de efectos: añadir `--blocked-url-patterns='*motion.js' --blocked-url-patterns='*motion.css'`; diagnóstico de cubo: `--blocked-url-patterns='*cubo.js'`. Son pruebas incompletas deliberadas, nunca una versión para entrega. Añadir `--save-assets` guarda la traza para profundizar.

Evidencia completa local: `outputs/PixelTEC-rendimiento-evidencia.zip` en la carpeta de este chat. Resumen persistente en este repo: `performance-2026-10-03.json`. No se instalaron dependencias en el proyecto ni se cambió su package-lock; Lighthouse se ejecutó mediante npx.
