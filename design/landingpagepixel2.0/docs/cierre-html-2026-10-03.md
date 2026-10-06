# ¿Qué quedó cerrado en el HTML y qué falta antes de Next/CMS?

2026-10-03 · WO-2026-00506 · rama `design/pixeltec-public-shell-20261002`.

La portada ES/EN entrega su contenido completo en el HTML inicial. Se conserva la fuente visual original por SHA-256, el cubo y las URLs; no hay deploy ni integración Next/CMS en este lote.

## Cambio y reproducción

- `home-ssr.mjs` ejecuta durante el build el mismo compilador y lógica DC con React server rendering y LinkeDOM 0.18.12 (solo desarrollo). No ejecuta efectos de montaje ni permite fetch. Se evalúa código local versionado; no es un sandbox para ejecutar código externo.
- El navegador usa `hydrateRoot` sobre `#dc-root`. La plantilla inerte sigue siendo datos para la mejora interactiva: su presencia ya no implica contenido exclusivamente cliente. Se retiraron la capa y el observador de primera pintura parcial.
- CSS gobierna los breakpoints antes y después de hidratar. El estado inicial determinista evita desacuerdos entre servidor y cliente. La lógica recoge el ancho real al montar.
- `inspectHome` valida estructura y cantidades mínimas de secciones; la suite compara el contenido aprobado completo con el HTML enviado. Un H2 decorativo o una portada sin Servicios fallan. Esto es control del prototipo, no una regla universal de Google.
- Compresión Brotli 11 únicamente para ambas portadas; mantiene el presupuesto de 30,000 bytes sin ampliarlo. Los demás archivos conservan Brotli 6. No se alteran variantes según auditor/UA.

Reproducir: `npm ci && npm run verify`, después `npm run preview` en localhost:4317. El ZIP autónomo incorpora el manifiesto de identidad generado existente.

## Ajustes visuales y accesibles

- En móvil las etiquetas se presentan compactas, sin física de arrastre; los CTA quedan visibles antes. En escritorio conservan física y parten de su composición visible, sin desaparecer al iniciar.
- El menú cerrado tiene visibilidad oculta y `aria-hidden`; al abrir expone diálogo y estado expandido, mueve el foco, limita Tab/Shift+Tab y bloquea scroll. Escape devuelve el foco. Sin scripts, el enlace de menú lleva al mapa localizado.
- Texto de presentación con contraste legible durante su revelado; foco visible en enlaces y botones. Retrato encuadrado a la derecha para no recortar más el rostro del archivo aprobado.
- Testimonios avanzan con controles de 44 px, sin temporizador automático. En ausencia de scripts se muestran todos en retícula.
- Corregido cubo que quedaba vacío al redimensionar en reposo: invalida el dibujo al resize/intersección/visibilidad. El ResizeObserver se conserva para poder desconectarlo; se retira su listener de visibilidad al destruir.

## Evidencia y límites

- `npm run verify`: strict/build, 11 pruebas, 145 HTML, 144 rutas, 60 slugs/metadatos, referencias y presupuestos. `src/home.dc.html` permanece con SHA-256 `b49e6c58fbe039b35e6ac5ad8685939ca8023d49d3d4d0b07657e9fb44df6e02`.
- Portada ES/EN: 1 H1, 7 H2; todas las secciones y textos contrastados antes de JS. Robots preview noindex, enlaces de idioma y datos estructurados conservados.
- [15 comprobaciones geométricas](html-visual-qa-2026-10-03.json): `/`, `/en/`, `/services/`, `/about/`, `/contact/` a 320, 768 y 1280 px. Sin overflow horizontal ni de títulos. No equivalen a 15 auditorías por captura.
- Navegador real: capturas de portada móvil/escritorio, secciones inferiores, Nosotros y Contacto tablet; menú ES/EN, foco/Escape/ciclo Shift+Tab, idioma y avance manual de testimonios. Consola consultada sin errores de aplicación o hidratación.
- Prueba visual adicional sobre copia temporal del `dist` con scripts retirados y bloque noscript activado: contenido, enlaces, pie y geometría móvil presentes. No se desactivó JavaScript mediante una preferencia del navegador; el fixture se elimina antes de entregar.
- Movimiento reducido revisado en CSS/lógica de las nuevas modificaciones; no emulado visualmente. Los efectos WebGL heredados mantienen sus reglas. No auditoría integral de accesibilidad, navegador múltiple, datos de campo ni nueva medición Lighthouse.

## Estado para continuar

`release:check` sigue bloqueado por NEXT_INTEGRATION incondicional; `HOME_INITIAL_CONTENT` pasa en ambas portadas. El build público sigue rechazándose antes de sustituir dist. El test de política pública continúa siendo un fixture del renderer interior, no un dist público ni una ejecución pública del reemplazo robots de portada.

Antes de publicar: integración Next/CMS y flujos existentes, traducciones largas/revisión editorial, candidato final y autorización humana. No se inventaron clientes, resultados comerciales ni garantías de posicionamiento.

## Conciliación de NeuroPIXEL

Miguel respondió «dale» a la asignación de tres archivos y ventana sin ediciones. Respaldo externo `work/vault-reconcile-20261003` con originales, versiones HEAD/origin/index, merge de tres vías y hashes. Base 34cda46e; avance a 38965ee1 por `git merge --ff-only`. Pixeltec.mx idéntico al remoto por SHA; el estado WAITING_MIGUEL y explicación de WO-505 preservados. README local/índice y los otros once archivos modificados quedaron byte-idénticos a su respaldo, con sus blobs indexados conservados. Sin stash ni update-index; no se eliminaron stashes antiguos ni se publicaron cambios ajenos.
