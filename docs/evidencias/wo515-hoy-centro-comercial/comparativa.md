# WO-2026-00515 · /hoy «Centro Comercial» — comparativa contra el mockup

Mockup: `Panel CRM PixelTEC_ Centro Comercial.png` (1672 px de ancho). Capturas tomadas en **localhost:4325** con Chrome headless (Playwright + Chrome del sistema), BD Postgres **local desechable** (docker `wo515-local-db`, migraciones del repo) con datos de demostración cargados solo ahí — **nunca BD de producción** y **ningún dato ficticio en el código**. Fecha simulada: la real del día (martes 6 oct 2026, CDMX).

| Archivo | Qué muestra |
|---|---|
| `claro-1672-vs-mockup.png` / `oscuro-1672.png` | Mismo ancho que el mockup, para comparación lado a lado |
| `claro-1440.png` · `oscuro-1440.png` | Página completa a 1440 |
| `claro-1024.png` · `oscuro-1024.png` | Página completa a 1024 (columna única bajo `xl`) |
| `claro-390.png` · `oscuro-390.png` | Móvil (rail de navegación móvil existente + pila de widgets) |
| `vacio-claro-1440.png` · `vacio-oscuro-1440.png` | BD vacía: estados vacíos honestos, ceros reales, sin `NaN`/`undefined` |
| `pixelbot-caido-1440.png` | PixelBot inalcanzable (egress bloqueado en local): aviso en Prioridades, resto de la página intacto |
| `claro-1440-vista-{pendientes,cobros,clientes-activos}.png` | Vistas del topbar `/hoy?vista=…` |
| `foco-teclado-1440.png` | Anillo de foco visible (`focus-visible:ring-2`) |
| `reduced-motion-1440.png` | `prefers-reduced-motion: reduce` |
| `publico-home-{claro,oscuro}-despues.png` | Sitio público tras el cambio: tokens `:root` idénticos a la base (ver abajo) |

## Fidelidad por widget

| Widget | Fidelidad | Fuente del dato | Desviación y por qué |
|---|---|---|---|
| Sidebar | Alta: marca + «Centro Comercial», Inicio activo en azul claro, Conversaciones con badge rojo, Clientes, Cotizaciones, Cobros, Calendario/Reportes/Automatizaciones, tarjeta «Tu equipo comercial, potenciado» | Registro de módulos | (1) Calendario/Reportes/Automatizaciones con chip «Pronto», sin enlace (estado `planned`, D-1): no existen. (2) Trabajo/Blog/SEO/Usuarios tras «Más» (D-3): ocultarlos daría 404. (3) Sin botón «Ver video» (D-12): no existe video. (4) Badge de no leídos solo para admin y solo si PixelBot responde. (5) 256 px en vez de ~200 para que «Automatizaciones» + «Pronto» no se corten. |
| Topbar | Alta: buscador ancho con ⌘K, segmented Hoy/Pendientes/Cotizaciones/Cobros/Clientes activos, «+ Nueva cotización», campana, avatar + nombre + rol + chevron | Sesión real, `useNotifications` | Nombre y rol reales («Administrador»/«Staff»), nunca «Carlos». Bajo 1536 px se oculta el texto nombre/rol (queda el avatar) para que quepan las vistas; bajo 1280 las vistas bajan como pills bajo el saludo. |
| Saludo + fecha | Idéntica | `users.name`, fecha CDMX | — |
| 5 KPI | Alta: icono tintado, etiqueta, valor, delta con flecha/color, sparkline (barras verdes en Cobrado) | Real/derivado (ver abajo) | Deltas honestos: «sin base» cuando el periodo anterior es 0 (no «+100 %» inventado); «Cotizaciones» compara *enviadas* hoy vs ayer y «Seguimientos» compara *programados*, y la etiqueta lo dice. Serie toda en cero ⇒ no se dibuja. |
| Prioridades de hoy | Alta en estructura (avatar, nombre, canal, mensaje 2 líneas + «Hace X», estado, monto, siguiente acción + fecha, botón, kebab) | Real/derivado | Chip «Correo» casi nunca aparece: `quotes` no guarda si salió por correo o wa.me, así que no se pinta canal sin evidencia; el mensaje es el hecho («Se envió la cotización COT-…»). WhatsApp/preview solo con PixelBot vivo (admin). En 1280–1535 px el estado+monto bajan bajo el mensaje (en 1536+ es una fila como el mockup). El conteo es el total real (puede ser > filas mostradas, máx. 5). |
| Hoy debes hacer esto | Alta (n/m, barra verde, checklist con hora / «Todo el día») | Derivado, solo lectura (D-5) | Casillas no clicables (`aria-disabled`): se marcan solas con evidencia del día; cada ítem enlaza a donde se hace la acción. |
| Cobros y pagos | Alta (3 filas + chip) | `billing_items` real | Chip extra «Vencido hace N días» (rojo) para vencidos. Concepto solo en `title`/sr-only por espacio. |
| Alertas | Alta (icono tintado, título, descripción, antigüedad) | Derivado | «Intención de compra alta / el bot detectó…» se sustituye por «Lead pidió contacto» (`leads.wants_contact`): no hay detector de intención. |
| Pipeline comercial | Alta (7 columnas tintadas, tarjetas nombre+monto, «+N más», chip de oportunidades) | Derivado sin migración (D-4) | Bajo ~1600 px las 7 columnas hacen scroll horizontal (snap). «Negociación» = cotización enviada con seguimiento hoy/vencido (no existe la etapa en BD). |
| Actividad reciente | Alta (filtros pill, 4 tarjetas con icono, título, subtítulo, «Hace X» + punto) | UNION derivado | «Ver toda la actividad» despliega hasta 12 eventos en la misma tarjeta (no existe una página de actividad global). |

## Datos: real · derivado · vacío

- **Real (lectura directa)**: Leads nuevos (feed global `leads`, igual que /clientes/leads), Cobros por vencer, Cobrado este mes, Cobros y pagos, nombre del usuario, conversaciones/no leídos de PixelBot (solo admin, solo lectura, tope 2.5 s).
- **Derivado**: Seguimientos hoy, Cotizaciones pendientes (`displayStatus`), Prioridades, checklist, Alertas, Pipeline, Actividad.
- **Vacío honesto**: cualquier fuente sin filas o caída — «Sin prioridades por ahora.», «Nada pendiente para hoy.», «Sin cobros pendientes.», «Sin alertas.», «Aún no hay oportunidades…», «Aún no hay actividad.»; KPI con fuente caída ⇒ «Sin datos» (nunca «$0»). «$0» solo aparece cuando la suma real del mes es cero.

## Sitio público sin cambios

`node public-probe` (scratchpad) leyó las variables CSS calculadas en `/` tras el cambio y coinciden con `:root`/`.dark` de la base `be00925`:

| Token | Claro (base = después) | Oscuro (base = después) |
|---|---|---|
| `--background` | 40 20% 97% | 0 0% 1% |
| `--primary` | 207 90% 54% | 207 90% 54% |
| `--border` | 40 12% 87% | 0 0% 12% |
| `--card` | 0 0% 100% | 0 0% 8% |
| `--muted-foreground` | 220 9% 38% | 0 0% 60% |

Nodos `.crm` en `/`: 0. No se tomó captura «antes» del público (requería otro servidor sobre la base con poco disco libre); la prueba de no-filtración es la igualdad de tokens y que `.crm` solo existe en el Shell del admin.

## Contraste

`node scripts/wo515-contrast-check.mjs` — todos los pares ≥ 4.5:1 (mínimo 4.84 en oscuro primary/sidebar-accent).

## Fase 2 (verificación independiente)

### KPI a 1440 / 1280 / 1024
`kpi-{1440,1280,1024}-{claro,oscuro}.png`: etiquetas y deltas ya no se recortan con «…»; envuelven a 2 líneas cuando falta ancho. Rejilla de KPI: 5 columnas desde 1400 px, 3 por debajo (a 1280 los 5 en una fila no dejaban espacio a valor + sparkline).

### Pipeline a 1440
`pipeline-1440-{claro,oscuro}.png`: a 1440 las 7 etapas no caben (≈916 px de mínimo vs ≈740 disponibles). Se deja scroll horizontal con `snap-mandatory` (aterriza al inicio de columna), región enfocable por teclado con nombre accesible y un desvanecido a la derecha que indica que hay más; desde ~1660 px caben las 7 sin scroll.

### Smoke /hoy, /whatsapp y /cobros con la paleta `.crm`
`smoke-{hoy,whatsapp,cobros}-{claro,oscuro}.png`. Fondos, tarjetas, bordes, tablas, filtros y textos toman el tema en ambos modos; ningún fondo queda sin cambiar. Muestreo automático de contraste (texto visible con ratio < 3:1 sobre su fondo efectivo):

| Página | Claro | Oscuro |
|---|---|---|
| /hoy | 0 | 0 |
| /whatsapp | 1 · pestaña activa «Bandeja» `text-cyan-300` sobre blanco (1.45:1) | 0 |
| /cobros | 7 · botones «Registrar pago» `text-cyan-300` (1.45:1) y chips de frecuencia `text-sky-500` (2.77:1) | 0 |

Causa: clases de color **fijas para fondo oscuro** dentro de componentes congelados (`src/components/cobros/cobros-view.tsx` y la consola de WhatsApp), no tokens. No dependen de `.crm`: en modo claro se veían igual antes de esta WO. No se corrigen aquí: los componentes están congelados/prohibidos y un override global de `.text-cyan-300` en `globals.css` tocaría 59 usos en el admin con riesgo colateral. En oscuro (tema por defecto del panel) todo pasa.

Consola: los únicos errores vienen del entorno local sin PixelBot (`/api/whatsapp-inbox/conversations` → 503 «PIXELBOT_TENANT_ID no configurado», y los `useInboxConversations error` de la consola de WhatsApp) más un `ClientFetchError` de next-auth al abortarse una petición durante una navegación. El hook del badge del sidebar traga su 503 sin romper nada; el «Failed to load resource» del navegador no se puede silenciar desde JS.

### Baseline `npm test`: origin/main vs rama
origin/main = `be009256c27e` (= base de la WO).

| | Archivos | Archivos fallidos | Tests | Pasan | Fallan |
|---|---|---|---|---|---|
| origin/main (worktree limpio, temporal) | 169 | 1 | 2149 | 2149 | 0 |
| feat/hoy-centro-comercial | 182 | 1 | 2247 | 2247 | 0 |

El único archivo fallido es `src/lib/blog/cluster-map.test.ts` en ambos lados, con el mismo error: `ENOENT … src/app/(public)/blog/[slug]/blog-post-client.tsx` (solo cambia la ruta del worktree). La rama no introduce regresiones.
