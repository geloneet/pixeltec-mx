# Optimización medida del inicio · 2026-10-03

Miguel autorizó optimizar el prototipo conservando diseño y efectos. **Resultado: 94/100 móvil y 100/100 escritorio (medianas de tres pruebas por perfil), con cubo 3D activo.** No se cambió el sitio público ni se integró todavía a Next.js.

| Mediana | Antes móvil | Después móvil | Antes escritorio | Después escritorio |
|---|---:|---:|---:|---:|
| Lighthouse | 60 | 94 | 91 | 100 |
| LCP | 7.96 s | 3.01 s | 1.69 s | 0.65 s |
| FCP | 3.10 s | 1.51 s | 1.05 s | 0.37 s |
| TBT | 404 ms | 68 ms | 21 ms | 0 ms |
| CLS | 0.012 | 0 | 0.005 | 0 |

Transferencia móvil: aproximadamente **1.76 MB → 0.387 MB (−78%)**, contando el bundle del cubo y los recursos que Lighthouse solicitó. LCP móvil baja alrededor de **62%** y el bloqueo **83%**. Puntuaciones finales de la serie: móvil 94, 94, 93; escritorio 100, 100, 100. El experimento intermedio con otra carga de fuentes dio móvil 91–96; no se mezcló con la serie final ni se escogió únicamente su mejor resultado.

## Cambios concretos

- Recursos de arranque locales y versiones npm fijadas: React 18.3.1, ReactDOM 18.3.1, Matter 0.19.0, Lenis 1.1.13, Three 0.184.0. Bundles separados de runtime y efectos, defer y CSS crítico en HTML. Las tres tipografías del primer viewport se precargan desde archivos locales con sus licencias.
- El runtime no vuelve a descargar el documento para remontarlo: esa recuperación solo se omite en la copia marcada data-dc-static. La exportación original permanece idéntica, comprobada por SHA-256.
- Three se empaqueta/minifica y el cubo usa menos subdivisiones, no preserva su buffer y cede al navegador antes del trabajo GPU. Se activa cerca del viewport; siguen existiendo cubo, interacción, materiales, iluminación, partículas, etiquetas físicas y efectos premium. No hay detección de Lighthouse ni variantes recortadas para obtener la puntuación.
- PNG original de 860,853 bytes convertido en build a WebP transparente de 360/720 px (~11/~24 KB), srcset/sizes, lazy y decoding async. Se preserva el original.
- Brotli/gzip precomprimidos, ETag/304, HEAD, MIME correcto y caché con revalidación. Los builds no quedan ocultos detrás de una caché larga. El servidor continúa limitado a 127.0.0.1:4317.
- Se corrigió el espacio del logo/CTA/menú móvil; a 320 px el menú queda dentro de la cabecera. El escritorio mantiene su composición.

## Verificación

`npm run verify` pasa TypeScript strict/build, 73 HTML, 3,714 referencias locales y las 60 rutas del sitemap. Las 72 rutas responden HTTP 200. Pruebas HTTP comprueban contenido descomprimido equivalente, gzip/Brotli, q=0, ETag/304, invalidación de etiqueta antigua, HEAD, MIME, 404, URL inválida, traversal y método no admitido. Presupuestos de peso impiden reintroducir bundles e imágenes pesados y protegen el hash original.

Revisión de navegador: inicio y cubo, apertura de escena y cuatro etiquetas, menú y Escape, navegación móvil a Servicios, cabecera a 320 px, sin overflow en 320/390/1440 y consola consultada sin errores. Captura entregada: `pixeltec-inicio-optimizado.jpg`.

## Método y límites

Lighthouse 13.5.0, Chrome 154 headless y mismo Mac mini que la línea base. Tres ejecuciones secuenciales por perfil, sin auditorías paralelas. Móvil de laboratorio: 412×823, DPR 1.75, CPU ×4 y red simulada 1.6 Mbps / RTT 150 ms; desktop usa preset desktop. Mediana independiente de cada métrica; no representa una única corrida. No hubo advertencias en la serie.

Tras la serie se ajustó exclusivamente la cabecera para <=360 px, ancho inferior al perfil Lighthouse. Se conservó una prueba adicional del HTML final (`confirmation-mobile`) por separado: **92/100**, LCP **2.98 s**, TBT **154 ms**, CLS **0**; no se añadió a la mediana de la serie. Configuraciones, resultados, hashes, tamaños y comprobaciones: `performance-optimized-2026-10-03.json`. Los reportes HTML/JSON completos están en el ZIP entregado.

**Deuda explícita:** LCP móvil sigue alrededor de 3 s, por encima del umbral bueno de 2.5 s; el siguiente salto requiere servir el contenido ya renderizado al integrar el diseño en el producto, reduciendo la dependencia del runtime DC para el primer contenido. No se afirma aprobación de Core Web Vitals, INP real, FPS sostenidos o batería. La nota alta no elimina esta limitación. Las variantes alternativas del editor heredado, no expuestas en la navegación, conservan imports CDN. Lenis permanece fijado por compatibilidad; su transitoria tempus emite un aviso de renombre en npm.

Al desplegar en otro hosting se deben reproducir compresión, MIME y caché; los archivos .br/.gz no se sirven solos. No hay deploy ni cambios de CRM/autenticación. README detalla operación; la decisión local conserva el alcance de prototipo.

Referencias técnicas: https://web.dev/articles/vitals · https://developer.chrome.com/docs/lighthouse/overview · https://esbuild.github.io/api/ · https://sharp.pixelplumbing.com/api-output/ .
