# WO-2026-00512 — Navegación y cubo

Fecha: 2026-10-06. Solicitud de Miguel: subir suavemente antes de cambiar de página, entrada gradual y cubo más ligero en móvil.

## Implementación

- Navegación interna con subida acotada a 420–900 ms, cancelable por rueda, toque, teclado o nuevo destino; precarga de destino y entrada de 620 ms. Cabecera/pie fuera de la transición. Enlaces externos, descargas, pestañas nuevas y anclas conservan su comportamiento.
- Respeta movimiento reducido. Recuperación de opacidad si el destino demora/falla.
- Cubo: DPR máximo 1 móvil/1.25 escritorio, geometría y entorno más pequeños, sin transmisión en cables móviles, un pulso móvil, render bajo demanda y suspensión fuera de pantalla/pestaña oculta. Vista previa de marca mientras carga.
- Runtime del cubo extraído del directorio generado. El compilador apunta al módulo canónico. Token de generación evita montajes asíncronos duplicados (detectado y corregido en QA).

## Evidencia local

- TypeScript `npx tsc --noEmit`: PASS.
- Vitest navegación + diagnóstico: 8/8 PASS.
- `git diff --check` y sintaxis JS: PASS.
- Navegador: desde scrollY=1440, al pulsar Servicios se observó scrollY=568 aún en `/`; luego `/services` a scrollY=0 y opacidad final 1, sin aria-busy residual.
- Móvil 390×844: sin desbordamiento horizontal; una única instancia del cubo y lienzo ~347×347. Captura `mobile-cube.png`.
- QA local con PostgreSQL desechable aislado en 5452 y migraciones versionadas. Sin datos productivos. El esquema migrado carece de app_settings: advertencia SEO local ajena al cambio; revisión final de producción obligatoria.

No se afirma una reducción porcentual global de CPU o carga: se verificaron los límites del render y la composición, no un benchmark de hardware móvil real.
