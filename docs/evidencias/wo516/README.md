# WO-2026-00519 — /hoy comportamiento comercial (evidencias)

Entorno: worktree `pixeltec-wo516`, `npm run dev -- -p 4326` servido en
`http://wo516.localhost:4326` (host propio para no compartir cookies con otras
sesiones en `localhost`). BD: contenedor desechable `wo515-local-db` con datos
demo. **Nunca producción.** Chrome real (claude-in-chrome), 2026-10-06.

Datos añadidos solo a la BD local para probar la actividad:

| Folio | Estado | sent_at | accepted_at | rejected_at | Conceptos |
|---|---|---|---|---|---|
| COT-2026-0105 | rechazada | hace 6 d | — | hace 1 d | 1 |
| COT-2026-0106 | rechazada | — | — | — | 1 (control: sin timestamps ⇒ sin eventos) |
| COT-2026-0107 | enviada | hace 3 h | — | — | 0 (control: total 0 ⇒ sin importe) |

## Capturas

- `00-selector-de-cliente.jpg`: «+ Nueva cotización» en /hoy abre el selector de cliente.
- `03-nueva-cotizacion-aterriza-en-cotizaciones.jpg`: al elegir cliente aterriza en la
  pestaña **Cotizaciones** con el formulario nuevo abierto (después del remontaje
  que provoca el `AnimatePresence` del shell).
- `04-refresh-y-adelante-conservan-cotizaciones.jpg`: refresh conserva la pestaña
  Cotizaciones y muestra el listado (el formulario no se reabre). Atrás → /hoy;
  adelante → otra vez Cotizaciones con el listado.
- `01-actividad-cotizaciones-oscuro.jpg` / `02-actividad-cotizaciones-claro.jpg`:
  «Actividad reciente» con el filtro Cotizaciones. Eventos enviada / aceptada /
  rechazada salen de timestamps reales; el importe solo aparece si hay total real.
  COT-2026-0106 no aparece; COT-2026-0107 aparece sin importe.

## Decisiones

- **Pestaña en la URL:** `?tab=cotizaciones` y `?tab=finanzas` ahora se respetan
  (antes caían en Resumen). Un cambio de search params remonta la página en el
  App Router, así que atrás/adelante y refresh siempre arrancan con la pestaña de la URL.
- **`nueva` de un solo uso:** el botón navega con `?nueva=<token>` (uno nuevo por
  clic). La pestaña abre el formulario si el token no está consumido. Se consume
  en sessionStorage al salir del formulario (cancelar/guardar), en `pagehide`
  (refresh/cierre) o al desmontarse con otra URL. No se consume al montar ni se
  quita de la URL: ambos rompían el flujo (verificado en navegador), porque el
  `AnimatePresence` del shell remonta la página al terminar la entrada y porque
  cambiar la URL remonta la página.
- **Límite (fuera de alcance):** hacer clic en otra pestaña del workspace NO
  actualiza la URL todavía; el estado vive en `useState` de
  `src/components/crm/ClientWorkspace.tsx`, que no está en los allowed_paths.
  `workspaceTabSearch()` (en `src/app/(admin)/clientes/[id]/workspace-url.ts`)
  ya está listo para cablearlo.

## Cómo reproducir

1. `docker start wo515-local-db`; `.env.local` con DATABASE_URL al contenedor.
2. `npm run dev -- -p 4326` y abrir `http://wo516.localhost:4326/hoy`.
3. «+ Nueva cotización» → elegir cliente → refresh → atrás → adelante.
4. /hoy → «Actividad reciente» → filtro «Cotizaciones» (claro y oscuro).
