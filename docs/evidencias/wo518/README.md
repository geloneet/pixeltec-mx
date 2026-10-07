# WO-2026-00521 — `cluster-map.test.ts` en rojo tras WO-2026-00513

Base: `3811ee3fac5e45549027d4ac5dc3279f63dbe7d1` (origin/main) · rama `fix/wo-518-cluster-map-test`.

## Qué protegía el test

`src/lib/blog/cluster-map.test.ts` (L3, WO-2026-00345) cubre dos cosas:

1. **El mapa en sí** (`RELATED_RESOURCES_BY_CATEGORY`, `DEFAULT_RELATED_RESOURCES`,
   `relatedResourcesFor`): cada destino existe, 2–3 por categoría, sin duplicar
   `internalLinks`, prioridad WhatsApp, fallback por defecto.
2. **Que la ficha del artículo lo consuma de verdad**: el componente del artículo
   importa `@/lib/blog/cluster-map`, llama a `relatedResourcesFor(` cuando el post no
   trae `internalLinks`, conserva el tracking `data-cta="internal_link"` y muestra el
   bloque «Recursos de PixelTEC mencionados». Sin esto, el mapa podría quedar huérfano
   (tests verdes, ningún artículo con enlaces internos de fallback).

## Por qué fallaba

WO-2026-00513 (commit `e445663`, "render articles on server") **renombró**
`src/app/(public)/blog/[slug]/blog-post-client.tsx` → `blog-post-content.tsx`
(similitud 98 %: `'use client'` → `import 'server-only'`, cambio de nombre del
componente). El test seguía leyendo la ruta vieja con `readFileSync` y fallaba a la
carga con `ENOENT`, arrastrando también los 6 tests del mapa (el archivo entero no
cargaba).

## Qué cambió

Solo `src/lib/blog/cluster-map.test.ts`: el bloque `describe` del consumidor apunta a
`blog-post-content.tsx` y documenta el renombre. **Ninguna aserción se relajó ni se
quitó**: la invariante sigue aplicando porque el componente server-only conserva las
cuatro señales (import en l.12, llamada en l.62, título en l.228, tracking en l.235).
No se tocó código de producción ni `src/app/(public)`.

Nota menor (no cambiada, fuera de necesidad): el comentario de `cluster-map.ts` dice que
el mapa "viaja al bundle del cliente"; desde WO-513 el consumidor es server-only, así que
esa justificación ya no es estrictamente cierta (el mapa literal sigue siendo válido).

## Cómo se demostró que sigue detectando

Sin tocar `src/app/(public)` (ni temporalmente): copia temporal del test
(`src/lib/blog/zz-mut.test.ts`, borrada después) que lee copias del archivo real en el
scratchpad, una por mutación:

| Variante | Resultado |
|---|---|
| original (`blog-post-content.tsx` sin cambios) | 7 passed |
| m1: import de `@/lib/blog/otro` en vez de `cluster-map` | 1 failed / 6 passed |
| m2: se quita la llamada `relatedResourcesFor(post…` | 1 failed / 6 passed |
| m3: `data-cta="internal_link"` → `data-x="y"` | 1 failed / 6 passed |
| m4: título «Recursos de PixelTEC mencionados» → «Enlaces» | 1 failed / 6 passed |

Y la ruta vieja (estado de `origin/main`) da `ENOENT` → archivo fallido (rojo de partida).

## Verificación

| Comando | Antes (base) | Después |
|---|---|---|
| `vitest run` completo | 1 archivo fallido · 181 pasan (182) · 2247 tests pasan | **182/182 archivos · 2254/2254 tests** (`npm test` exit 0) |
| `npx tsc --noEmit` | — | exit 0 |
| `npm run lint` | — | exit 0 (solo warnings preexistentes) |
