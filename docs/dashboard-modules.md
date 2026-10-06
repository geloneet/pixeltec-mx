# Registro central de módulos del dashboard

`[Verificado en código]` · WO-2026-00088 → WO-2026-00132 → WO-2026-00515 · registro descrito en el repo como «ADR-0054 propuesta» (`docs/adr/ADR-0054-registro-central-de-modulos.md`).

> Nota de trazabilidad: en el vault NeuroPIXEL el número ADR-0054 corresponde a *«ProjectPlan v1 como contrato read-only»*, no a este registro. La referencia del repo es una propuesta local sin número asignado en el vault; conviene renumerarla cuando se acepte.

## Qué es

`src/lib/modules/registry.ts` es la **única fuente de verdad** de qué módulos del admin existen y en qué estado:

| Estado | Significado | Navegación | Ruta |
|---|---|---|---|
| `active` | módulo normal | visible | se sirve |
| `protected` | visible pero **congelado** por decisión de producto (WhatsApp/PixelBot en revisión de Meta; Finanzas) | visible | se sirve; solo se integra en la nav, sin cambios internos |
| `hidden` | fuera de toda superficie | no | **404** dentro del shell (guard) |
| `legacy` | como `hidden` y además superado por otro módulo (`supersededBy`) | no | 404 |
| `planned` | anunciado, **aún no construido** (WO-2026-00515) | fila deshabilitada «Pronto» en el sidebar, sin enlace (`aria-disabled`) | **no tiene rutas** (`routes: []`); fuera de ⌘K, 404, submenús e Inicio |

Superficies que leen el registro: sidebar desktop (`app-sidebar.tsx`), rail móvil (`top-navigation.tsx`) y submenú (`secondary-navigation.tsx`) vía `nav-config.ts`; ⌘K (`command-palette.tsx`); widgets de Inicio (`src/components/hoy/inicio-surface.ts`); quick links del 404 (`(admin)/_not-found-client.tsx`). Las secciones del workspace de Clientes tienen su propio registro en `src/lib/modules/client-workspace.ts`.

**Nada se oculta con `if (false)`, CSS `display:none`, comentarios ni arreglos por pantalla.** `src/lib/modules/registry.test.ts` lo vigila.

## Estado actual (2026-10-06, WO-2026-00515)

| Módulo | Estado | Etiqueta visible | Ruta |
|---|---|---|---|
| inicio | active | Inicio | `/hoy` |
| whatsapp | protected | **Conversaciones** | `/whatsapp` (intacta) |
| clientes | active | Clientes | `/clientes`, `/clientes/leads` |
| cotizaciones | active | Cotizaciones | `/cotizaciones` |
| finanzas | protected | **Cobros** | `/cobros` (intacta) |
| calendario | **planned** | Calendario · Pronto | — |
| reportes | **planned** | Reportes · Pronto | — |
| automatizaciones | **planned** | Automatizaciones · Pronto | — |
| proyectos | active | Trabajo (bajo «Más») | `/proyectos` |
| blog | active | Blog (bajo «Más») | `/blog-cms` |
| seo | active | SEO (bajo «Más») | `/seo/*` |
| usuarios | active | Usuarios (bajo «Más») | `/usuarios` |
| notificaciones · perfil · smilemore-respuestas | active | controles globales / enlace contextual | sin área |

Orden del sidebar (mockup «Centro Comercial»): grupo principal `NAV_PRIMARY_AREAS` (Inicio · Conversaciones · Clientes · Cotizaciones · Cobros), filas `planned`, y tras el separador **«Más»** el resto de `NAV_AREA_ORDER`. Las etiquetas viven solo en `NAV_AREA_LABELS`: los slugs internos (`whatsapp`, `finanzas`) y las rutas no cambian. Hoy no hay módulos `hidden` ni `legacy` (WO-2026-00132 los borró de verdad).

## Inicio (`/hoy`) — widgets y módulo dueño

`INICIO_WIDGETS` (`src/components/hoy/inicio-surface.ts`) mapea cada widget a un módulo; la página solo lo pinta si `isModuleVisible(módulo)`:

| Widget | Módulo |
|---|---|
| KPI Leads nuevos | clientes |
| KPI Seguimientos hoy · KPI Cotizaciones pendientes | cotizaciones |
| KPI Cobros por vencer · KPI Cobrado este mes · Cobros y pagos | finanzas |
| Prioridades de hoy · Pipeline comercial · Actividad reciente | clientes |
| Hoy debes hacer esto · Alertas | inicio |
| Conversaciones (previews/no leídos de PixelBot) | whatsapp |

Datos: `src/lib/hoy/` — instantánea por owner (`queries/snapshot-queries.ts`, PixelBot de solo lectura con tope de 2.5 s en `queries/conversaciones.ts`), derivaciones puras en `derive/*` (TZ `America/Mexico_City`) y orquestación en `dashboard.ts` (`settle` por pieza: un loader caído solo apaga sus widgets). Sin migraciones: el pipeline, el checklist y las alertas son **derivados** (ver comentarios de `derive/pipeline-stages.ts`, `derive/checklist-items.ts`, `derive/alert-rules.ts`).

### Vistas del topbar

`src/components/hoy/hoy-views.ts` define las vistas como `/hoy?vista=hoy|pendientes|cotizaciones|cobros|clientes-activos` (módulo `inicio`, no son rutas nuevas). Filtran el panel de Prioridades. Desde `xl` viven en el topbar; por debajo, como pills bajo el encabezado.

## Guard de ruta (patrón único)

Cada módulo `hidden`/`legacy` debe tener un `layout.tsx` en la raíz de su ruta que llame a `assertModuleRouteEnabled("<id>")` (`src/lib/modules/route-guard.ts`): mientras el registro lo marque oculto, la URL responde `notFound()` dentro del shell. El middleware de sesión (`src/lib/routes/admin-routes.ts`) actúa antes; el rol `reviewer` recibe 403 antes del guard (WO-2026-00051). Hoy no hay rutas con guard porque no hay módulos ocultos. Los `planned` no necesitan guard: no tienen rutas.

## Cómo construir un módulo `planned`

1. Crea su ruta en `src/app/(admin)/<ruta>/`.
2. `registry.ts`: `state` → `active` y `routes` con sus prefijos.
3. Añade su slug a `ADMIN_ROUTES`, su destino a `PALETTE_NAV_ITEMS` (`module: "<id>"`) y un área en `NavArea`/`NAV_AREA_ORDER`/`NAV_AREA_LABELS`/`AREA_ITEMS` con su icono en `AREA_ICONS`; decide si entra en `NAV_PRIMARY_AREAS`.
4. Actualiza **a mano** `EXPECTED_STATES` (`registry.test.ts`), las expectativas de `nav-integrity.test.ts` y `app-sidebar.render.test.tsx`.

## Cómo ocultar / reactivar un módulo

- Ocultar: `state` → `hidden` (o `legacy` + `supersededBy`) y crea el `layout.tsx` con el guard si no existe.
- Reactivar: `state` → `active`; los widgets de Inicio y secciones de Clientes reaparecen solos.
- En ambos casos: `npm test -- src/lib/modules src/components/nav src/components/hoy` y smoke en navegador (sidebar, rail, ⌘K, 404).
