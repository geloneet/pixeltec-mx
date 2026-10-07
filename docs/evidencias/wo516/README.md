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
  Cotizaciones y muestra el listado (el formulario no se reabre). Verificado
  también: abrir → atrás (sin refresh) → /hoy con la intención ya consumida →
  adelante → Cotizaciones con el listado.
- `01-actividad-cotizaciones-oscuro.jpg` / `02-actividad-cotizaciones-claro.jpg`:
  «Actividad reciente» con el filtro Cotizaciones. Eventos enviada / aceptada /
  rechazada salen de timestamps reales; el importe solo aparece si hay total real.
  COT-2026-0106 no aparece; COT-2026-0107 aparece sin importe.

## Decisiones

- **Pestaña en la URL:** `?tab=cotizaciones` y `?tab=finanzas` ahora se respetan
  (antes caían en Resumen). Un cambio de search params remonta la página en el
  App Router, así que atrás/adelante y refresh siempre arrancan con la pestaña de la URL.
- **`nueva=1` de un solo uso:** la URL sigue siendo `?tab=cotizaciones&nueva=1`
  (contrato fijado por `src/components/nav/admin-topbar.render.test.tsx`). Antes
  de navegar, el botón guarda en sessionStorage una intención `{clientId}`. La
  pestaña abre el formulario solo si hay `nueva=1` **y** una intención pendiente
  para ese cliente. La intención se consume al salir del formulario (cancelar o
  guardar), en `pagehide` (refresh o cierre) o al desmontarse con otra URL (se
  navegó a otra parte). Nunca al montar, y `nueva` nunca se quita de la URL:
  ambas cosas rompían el flujo (verificado en navegador), porque el
  `AnimatePresence` del shell remonta la página al terminar la animación de
  entrada y porque cambiar los search params remonta la página. Un enlace con
  `?nueva=1` pegado a mano (sin intención) abre el listado. Sin sessionStorage
  disponible se abre el formulario, como antes.
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

## Polish de cierre (2026-10-07)

Misma BD local y host `wo516.localhost:4326`. Medido con JS en la página
(ancho del título vs. su contenido, líneas, scroll horizontal) y capturado en
claro y oscuro.

| Ancho | Títulos recortados | Líneas máx. del título | Scroll horizontal | Capturas |
|---|---|---|---|---|
| 1440 | 0 / 8 | 2 | no | `polish-1440-{oscuro,claro}.jpg` |
| 1280 | 0 / 8 | 2 | no | `polish-1280-{oscuro,claro}.jpg` |
| 1024 | 0 / 8 | 1 | no | `polish-1024-{oscuro,claro}.jpg` |
| 500* | 0 / 8 | 1 | no | `polish-500-{oscuro,claro}.jpg` |

\* Chrome no deja la ventana por debajo de 500 px y la app bloquea el iframe
(CSP), así que 390 no se midió directamente. 500 y 390 caen en el mismo
breakpoint (< `sm` = 640 px, una columna).

1. **Pipeline sin «$0».** Una tarjeta solo muestra importe si es real: finito,
   > 0 y moneda MXN/USD (`formatRealCents` en `derive/common.ts`; en cobros,
   monto > 0). COT-2026-0107 (sin conceptos, PixelState en Negociación) queda
   solo con el nombre. Antes mostraba «PixelState $0 MXN».
2. **Títulos completos en «Actividad reciente».** El título envuelve
   (`break-words`, sin `truncate`) y la hora relativa pasa debajo del texto. Antes,
   a la derecha, competía con el título («Cotización e…», «Cotización rech…»). Hay
   un test que falla si vuelven `truncate`, `line-clamp` o la hora en la fila del título.
3. **«Aceptada» con precisión de día.** `quotes.accepted_at` se guarda a las
   12:00 de la fecha que se elige al marcarla aceptada (`acceptQuote` en `src/lib/quotes/actions.ts`):
   el día es real, la hora no. Esos eventos llevan `precision: "day"` y el
   feed muestra solo «Hoy», «Ayer» o la fecha corta (p. ej. «3 oct»), con un
   tooltip de solo fecha. Enviada y rechazada sí tienen la hora real del clic y
   conservan «Hace N horas» y el tooltip con hora.
