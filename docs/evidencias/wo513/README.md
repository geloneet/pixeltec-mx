# WO-2026-00513 — Auditoría final de rendimiento y SEO

Fecha: 2026-10-06. Alcance: pixeltec.mx público; no modifica panel, permisos ni datos de clientes.

## Línea base real

PageSpeed Insights `d76ftph818` (13:42 México, Lighthouse 13.5.0): móvil 56/93/100/100; escritorio 68/93/100/100 (rendimiento/accesibilidad/prácticas/SEO). Móvil FCP1.7s, LCP4.3s, TBT2140ms, CLS0; escritorio FCP0.5s, LCP0.8s, TBT2020ms, CLS0.002. Sin datos CrUX suficientes: estas mediciones de laboratorio no certifican INP real ni todos los dispositivos.

Crawl de 135 URLs: cero errores HTTP, canonical/H1/descripción ausentes, alt ausente o JSON-LD inválido. Sitemap:70 URLs únicas, todas indexables y sin redirección. 64 noindex del catálogo:62 EN y2 ES (metodología/guías), política editorial previa conservada. No se inventa aprobación de traducciones ni se añade hreflang hacia URLs noindex.

Google Rich Results validó Organización y Negocio local. Aviso opcional `priceRange`: no se inventan tarifas para eliminarlo. Search Console:75 indexadas y204 excluidas, datos del20/9 anteriores al lanzamiento. La propiedad de dominio incluye subdominios: varios404 pertenecen a Encino, no a esta web. Se conserva evidencia histórica sin declarar esas exclusiones como fallos nuevos.

## Correcciones

- Cubo aprobado con póster WebP responsive de12/24KB. Three/WebGL solo se descarga y monta al pulsar «Explorar en3D»; navegación y contenido no dependen de GPU. Un único montaje reutilizable, fallback accesible si WebGL falla. Se preservan límites DPR, suspensión fuera de pantalla y movimiento reducido.
- Consentimiento: copy breve ES/EN y contraste del botón, manteniendo bloqueo de Meta hasta aceptar y rechazo igual de accesible.
- Ratings con rol de imagen; azul del wordmark sobre crema ajustado para contraste.
- Schema usa el logo vigente y evita nodos genéricos duplicados frente a los esquemas completos de cada página. Hub de servicios sin Service/ItemList genéricos vacíos.
- lastmod refleja fechas verificables del rediseño/auditoría; no cambia en cada solicitud.

## Verificación previa

TypeScript estricto PASS. Vitest57/57 (cubo, consentimiento y SEO). Navegador local:0 lienzosWebGL antes de interacción,1 después; póster real renderizado, sin salto de geometría. QA usa PostgreSQL desechable existente en5452, sin datos productivos. El esquema local tiene advertencia previa app_settings; validación definitiva se realiza en producción.

## Pendiente para cierre

Compilación/deploy gobernado, repetición PSI y crawl, revisión responsive, estado de sitemap en Search Console y sincronización de evidencia.
