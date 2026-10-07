# WO-2026-00517 — Contraste en modo claro: `/cobros` y `/whatsapp`

## Método

- Chrome real, dev local `http://wo517.localhost:4328` contra BD desechable `wo515-local-db`
  (datos demo; se añadió solo en esa BD un contrato y `next_due_date` para que se vean
  «Contrato…» y «Próximo:»). `/whatsapp` sin PixelBot (`PIXELBOT_TENANT_ID` ficticio,
  `PIXELBOT_INTERNAL_URL` vacío): estado de error 503 de la bandeja y las 5 pestañas
  (Bandeja, Cuenta, Bot, Entrenamiento, Pruebas). Tema cambiado con `localStorage['pt-theme']`.
- `contrast-sample.js`: recorre todos los nodos de texto visibles, compone los fondos
  translúcidos de los ancestros hasta el primer fondo opaco, aplica la opacidad acumulada
  al color del texto y calcula el ratio WCAG 2.x. Umbral 4.5:1 (3:1 solo texto grande
  ≥24px o ≥18.66px bold; aquí ningún texto afectado lo es). Controles `:disabled` se
  excluyen (WCAG 1.4.3).
- Modo oscuro: se guardó antes del cambio la lista completa (texto, color computado,
  color efectivo, fondo, ratio) por página/pestaña y se comparó nodo a nodo después.

## Pares elegidos (claro → oscuro conservado)

| Uso | Antes | Después | Fondo claro medido | Ratio claro |
|---|---|---|---|---|
| Botón «Registrar pago» (tabla, móvil, diálogo) | `text-cyan-300` (1.32) | `text-cyan-800 dark:text-cyan-300` | `#e6f8fb` (cyan-500/10) | 6.63 (hover cyan-500/20: 6.04; fila hover: 5.80) |
| Chip de frecuencia | `text-[#0EA5E9]` = sky-500 (2.51) | `text-sky-700 dark:text-[#0EA5E9]` | `#e7f6fd` | 5.37 (fila hover: 5.13) |
| «—», «Contrato…», «Próximo:» | `text-muted-foreground/70`, `/60` (3.00, 2.49) | `text-muted-foreground dark:text-muted-foreground/70` (`/60`) | `#ffffff` | 5.61 |
| Error del diálogo de pago | `text-red-400` | `text-red-700 dark:text-red-400` | card blanca | ≈6.5 (no visible en el muestreo) |
| Pestaña activa consola (Bandeja/Cuenta/Bot/…) | `text-cyan-300` (1.45) | `text-cyan-700 dark:text-cyan-300` | `#ffffff` | 5.36 |
| Subpestaña activa «Simulador» / pestaña de ContactPanel | `text-cyan-300` (1.35) | `text-cyan-700 dark:text-cyan-300` | `#f6f7f9` | 5.00 |
| Hover «limpiar»/«cargar más» en ConversationList | `hover:text-cyan-300` | `hover:text-cyan-700 dark:hover:text-cyan-300` | — | 5.36 |
| Textos secundarios de la consola (`/60`, `/70`, `/80`) | p. ej. 2.41 «No se pudo cargar la configuración.», 3.55 descripción de sección | `text-muted-foreground dark:text-muted-foreground/NN` | `#f6f7f9` / `#fafafb` | 5.23 / 5.38 |
| Badges ámbar sobre `amber-500/10–15` (variables faltantes, «Borrador», «Media», «En revisión», etc.) | `text-amber-700` (4.23 sobre amber/5+10) | `text-amber-800` (dark: sin cambio) | `#f6ead6` | 5.97 (amber/15: 6.32) |

No se tocó `globals.css` (sin overrides globales).

## Conteos (textos < umbral)

| Página | Claro antes | Claro después | Oscuro antes | Oscuro después | Nodos oscuro con color distinto |
|---|---|---|---|---|---|
| `/cobros` (datos originales) | 7 | 0 | — | — | — |
| `/cobros` (+contrato/próximo demo) | 10 | 0 | 3 | 3 | 0 / 77 |
| Diálogo «Registrar pago» | 1 | 0 | — | — | — |
| `/whatsapp` Bandeja | 1 | 0 | 0 | 0 | 0 / 37 |
| `/whatsapp` Cuenta | 4 | 0 | 0 | 0 | 0 / 37 |
| `/whatsapp` Bot | 2 | 0 | 1 | 1 | 0 / 34 |
| `/whatsapp` Entrenamiento | 1 | 0 | 0 | 0 | 0 / 34 |
| `/whatsapp` Pruebas | 3 | 0 | 0 | 0 | 0 / 36 |

Conteos sin «Más» (encabezado del sidebar global, `text-muted-foreground/80`, 3.65:1
en claro): está en `src/components/nav/app-sidebar.tsx`, fuera del alcance del WO.

Los fallos del modo oscuro (`/60`/`/70` sobre fondo oscuro, 3.38–4.13) existían antes y se
conservan a propósito: el WO exige que el oscuro quede idéntico.

## Capturas

`antes-*` / `despues-*` para `cobros-claro`, `cobros-dialogo-claro`, `cobros-oscuro`,
`whatsapp-claro`, `whatsapp-oscuro`.
