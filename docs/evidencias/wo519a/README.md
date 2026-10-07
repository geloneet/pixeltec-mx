# WO-2026-00526 — pestaña del workspace de cliente en la URL

Hijo de WO-2026-00519. Rama `feat/wo-519a-tab-url` (base `b692405`). Pruebas en Chrome real
contra `http://wo519a.localhost:4326` (dev server, BD local desechable `wo515-local-db`,
cliente demo PixelState). Fecha: 2026-10-06.

## Qué cambió

- `ClientWorkspace` acepta `onTabChange?(tab)`. Se llama en el clic de pestaña (y en los
  cambios internos a Portal/Comercial), **no** al pulsar la pestaña ya activa. Además sigue
  a `initialTab` si la URL cambia sin remontar el componente.
- `clientes/[id]/page.tsx`: `onTabChange` → `router.replace(pathname + workspaceTabSearch(...), { scroll: false })`.
  `workspaceTabSearch` fija `tab`, quita `nueva` (y `sub` fuera de Comercial) y conserva los demás parámetros.
- Al salir de una URL con `?nueva=1` cambiando de pestaña, se consume la intención de un solo uso
  (`consumeNuevaOnTabChange`, ver «Remontaje» abajo).

## Decisión: `replace` y no `push`

Se eligió **`router.replace`**:

- No ensucia el historial: `history.length` se queda igual en todos los clics de pestaña (medido: 5 → 5 en 7 clics).
- Atrás sale de la página del cliente y, al volver con adelante, se restaura la **última pestaña elegida**.
- No deja una entrada `?tab=cotizaciones&nueva=1` a la que volver con atrás: con `push`, esa
  entrada seguiría en el historial y atrás regresaría al deep-link del formulario nuevo. Esa es
  justamente la trampa que WO-2026-00519 tuvo que resolver.
- `push` no se probó de punta a punta en el navegador; se descartó por ese diseño. Si Miguel
  quiere que atrás recorra las pestañas, el cambio es de una línea en `page.tsx`.

## Pruebas en navegador (resultados medidos)

| Paso | URL | Pestaña activa |
|---|---|---|
| /hoy → Clientes → PixelState | `/clientes/ID` | Resumen |
| Clic en Cotizaciones | `?tab=cotizaciones` | Cotizaciones |
| Clic en Finanzas | `?tab=finanzas` | Finanzas |
| Refresh (cmd+R) | `?tab=finanzas` | Finanzas |
| Barra lateral → Cobros | `/cobros` | — |
| Atrás | `/clientes/ID?tab=finanzas` | Finanzas |
| Atrás | `/clientes` | — |
| Adelante | `/clientes/ID?tab=finanzas` | Finanzas |
| Adelante | `/cobros` | — |
| Atrás | `/clientes/ID?tab=finanzas` | Finanzas |

Atrás/adelante se ejecutaron con `history.back()` / `history.forward()` en la página. La acción
«back» de la extensión no recorría las entradas `pushState` de la SPA, así que no sirvió como
prueba. El refresh se hizo con cmd+R real.

Flujo «+ Nueva cotización» (`/hoy` → botón → elegir PixelState):

| Paso | URL | Formulario | Intención en sessionStorage |
|---|---|---|---|
| Aterriza | `?tab=cotizaciones&nueva=1` | abierto | sí |
| +2 s (tras la animación del shell) | igual | abierto | sí |
| Clic en Cotizaciones (ya activa) | igual (sin cambio) | abierto | sí |
| Refresh | `?tab=cotizaciones&nueva=1` | **cerrado** (lista) | no |
| (de nuevo desde /hoy) Clic en Finanzas desde el formulario | `?tab=finanzas` | — | **no** (consumida) |
| Clic en Cotizaciones | `?tab=cotizaciones` | cerrado (lista) | no |
| Atrás | `/hoy` | — | no |
| Adelante | `?tab=cotizaciones` | cerrado | no |

Capturas: `01-refresh-conserva-cotizaciones.jpg`, `02-atras-desde-cobros-restaura-finanzas.jpg`,
`03-hoy-nueva-cotizacion-elige-cliente.jpg`, `04-nueva-cotizacion-formulario-abierto.jpg`,
`05-refresh-no-reabre-formulario.jpg`.

## Remontaje (medido)

- Con un `MutationObserver` se marcó el nodo DOM de la barra de pestañas. En 7 de 8 clics, después
  de `router.replace`, el nodo **siguió siendo el mismo**: el cambio de search params **no** remontó
  la página. Nunca hubo un frame sin la barra.
- En un solo clic, el primero hacia Finanzas tras arrancar el dev server, el nodo cambió. Es
  compatible con la compilación bajo demanda del chunk en dev. No se vio parpadeo ni hubo frames sin barra.
- Lo único que se ve es el spinner propio de la pestaña recién montada (Cotizaciones ≈ 100-200 ms,
  Finanzas ≈ 180-800 ms en dev). Ya existía antes del cambio, porque cambiar de pestaña siempre montó su loader.
- Hallazgo y mitigación: al cambiar de pestaña desde el formulario nuevo, `CotizacionesTab` se
  desmonta **antes** de que `replace` actualice la URL. Su limpieza («desmontarse con otra URL»)
  veía la URL vieja y la intención quedaba pendiente (medido: `intent:true` tras pasar a Finanzas).
  Con `replace` no era explotable, porque la entrada `nueva=1` ya no existe. Aun así, `page.tsx`
  ahora la consume al salir de `?nueva=1` (medido: `intent:false`). No se editó `CotizacionesTab`
  ni `nueva-cotizacion-intent.ts`; solo se importa su API.
- Por si la URL cambia sin remontar, `ClientWorkspace` ajusta su estado a `initialTab` en el render
  (sin efecto). Hay un test para esto.

## Tests (TDD rojo → verde)

- `ClientWorkspace.test.tsx`: clic → `onTabChange(id)`, pestaña inicial desde `initialTab`, clic en
  la pestaña activa no avisa, prop opcional y seguimiento de `initialTab`.
- `workspace-url.test.ts`: ida y vuelta clic → URL → refresh para las 3 pestañas visibles, `nueva=1`
  no sobrevive al cambio, se conservan los parámetros ajenos (y `sub` en Comercial),
  `workspaceTabHref` y `consumeNuevaOnTabChange`.
