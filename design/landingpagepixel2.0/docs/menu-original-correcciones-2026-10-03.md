# ¿Qué se corrigió en el menú y los defectos visuales reportados?

Miguel pidió el 2026-10-03 conservar los elementos del menú original de pixeltec.mx y corregir los errores de sus capturas: banda negra junto a la cabecera de interiores y personaje recortado en Nosotros. Cambios aplicados únicamente al prototipo local; slugs y sitio público intactos.

## Fuente y cambio

La navegación pública se consultó directamente en https://pixeltec.mx/ el 2026-10-03: **Inicio, Nosotros, Servicios, Industrias, Blog, Contacto**, en ese orden, con destinos `/`, `/about`, `/services`, `/industrias`, `/blog`, `/contact`. `src/navigation.ts` es ahora la única lista compartida por cabecera, menú de inicio e interiores; se conserva el sufijo y se aplica el prefijo `/en/` al inglés. Proyectos permanece accesible desde el contenido y enlaces secundarios, sin ocupar un elemento principal que no existe en la web original.

La composición existente conserva logo central, crema, CTA azul e icono de menú. Se distribuyen los seis enlaces en dos filas de tres para no comprimirlos contra el logo; por debajo de 1001 px pasan al menú desplegable. En el inicio este menú muestra las seis entradas también en escritorio. Los cambios de la exportación se hacen solo en la copia generada; el original mantiene su SHA-256.

El fondo exterior de `.header-shell` ahora coincide con el blanco de los interiores, eliminando las franjas negras de la captura. El inicio conserva sus márgenes oscuros sobre el hero oscuro. El selector de idioma del panel oscuro recupera contraste claro.

Nosotros usa una retícula con tres espacios independientes: rótulo, imagen y pie. La imagen se contiene completa (`object-fit: contain`), sin posicionamiento absoluto que cortaba la cabeza. Las columnas tienen `minmax(0,1fr)` y espacio inferior antes de la sección negra, evitando recortes y secciones pegadas. Se conserva el recurso original, sin generar ni editar la imagen.

## Validación

- `npm run verify`: TypeScript strict/build, 145 HTML, **8,178 referencias locales**, 60 slugs/metadatos publicados y 144 rutas HTTP 200; cinco pruebas Node y presupuestos de peso pasan.
- Navegador real: seis páginas (inicio, Nosotros, Servicios, ES/EN) a **320, 390, 768, 1024, 1280 y 1840 px**. Se verificó el ancho real, no solo el solicitado. Las 36 vistas no desbordan y las cajas de imagen permanecen dentro de su panel. Datos en `menu-visual-checks-2026-10-03.json`.
- Revisión visual: cabecera a 1840 px, personaje y ambos textos completos, menú móvil del inicio, navegación a Servicios, menú interior con seis elementos y traducciones EN.
- Escape cierra el dialog interior y devuelve foco a Abrir menú; selector inglés/español legible y con destino contextual. Consola consultada sin errores.

No se repitió Lighthouse para esta corrección de CSS/navegación; los presupuestos de assets sí pasan. No es una certificación exhaustiva de accesibilidad ni de todas las páginas en cada dispositivo. Continúan los límites de contenido/traducción/integración declarados en el reporte anterior.

## Continuidad operativa

Editar los elementos en `src/navigation.ts`, nunca duplicarlos en plantillas. `src/home-content.ts` transforma la copia de inicio; `public/content.css` contiene los ajustes acotados. `npm ci`, `npm run verify`, `npm run preview` reproducen el resultado en 127.0.0.1:4317. Durante la tarea Miguel cambió la fuente canónica a `/Users/pixeltec/Projects/neuropixel-operativo`; se consultó y trasladó allí el seguimiento, preservando las modificaciones ajenas. No se despliega ni se cambia el stack del producto.
