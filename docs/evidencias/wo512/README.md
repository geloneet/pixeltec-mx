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

## Publicación verificada

- PR168 integrado; release `1dd55455f4730145b412efa9f84322334125d3a0` activa desde 2026-10-06T19:30:24Z (13:30 México).
- Wrapper `deploy-pixeltec-mx`: check-only y deploy rc0, rollback=no. Log VPS `/home/ubuntu/deploy-logs/pixeltec-mx-20261006T191556Z-1dd55455f473-deploy.log`. Recuperación disponible `d049cdc115749617e86b61450f9c1934975b5537`.
- Compilación de producción, tipos, 205 páginas y salud `/`, `/login`, `/api/health` PASS. Base de datos intacta.
- Smoke de 135 rutas públicas PASS (`smoke.json`).
- Navegador real: `/` scroll1440 → scroll563 aún en Inicio → `/services` scroll0; opacidad final1 y aria-busy retirado.
- Móvil390×844: cubo listo, un lienzo, sin overflow horizontal; `live-mobile.png`. Sin errores de consola observados desde la activación.
- Entorno local de QA detenido (servidor4321 y contenedor propio `pixeltec-wo512-qa`); no se utilizaron ni alteraron bases de otros proyectos.
