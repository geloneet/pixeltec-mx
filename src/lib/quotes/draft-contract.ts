// Exact extracted canonical quote contract; source actions.ts @e5047c0.
// SHA256 of original block: 2cd112c99f75f2c96295805cebde1aa46ba82a92f4a721fe26aedb87223b2b71
import {z} from 'zod';
import {createInsertSchema} from 'drizzle-zod';
import {quotes} from '@/lib/db/schema';
import {RECURRENCES} from '@/lib/quotes/money';
import {CURRENCIES,PAYMENT_TYPES} from '@/lib/quotes/terms';
const ItemSchema = z.object({
  description: z.string().max(500),
  quantity: z.number().finite().min(0).max(1_000_000),
  unitPriceCents: z.number().int().min(0).max(999_999_999),
  // Ausente ⇒ pago único: las cotizaciones guardadas antes de esta orden no lo
  // traen y deben seguir guardándose sin tocar nada.
  recurrence: z.enum(RECURRENCES).optional(),
  // Sin esta línea zod BORRA la bandera en silencio —`z.object` descarta las
  // claves que no declara— y «primer año gratis» se guardaría como una anual
  // normal: el total inicial subiría 899 al reabrir. Mismo fallo que ya pasó
  // con `recurrence` el 2026-08-26, ahora con el saneador de escritura.
  firstYearFree: z.boolean().optional(),
});

export const SaveQuoteSchema = createInsertSchema(quotes, {
  id: z.string().uuid().optional(),
  // OJO: es el id PÚBLICO del cliente (ADR-0035), no el uuid de Postgres.
  // La pantalla de cliente vive en /clientes/<publicId>. Se resuelve abajo.
  clientId: z.string().min(1).max(64),
  title: z.string().max(200),
  items: z.array(ItemSchema).max(100),
  taxEnabled: z.boolean(),
  notes: z.string().max(5000),
  validUntil: z.string().max(40).nullable(),
  // ── MVP comercial (WO-2026-00104) ────────────────────────────────────────
  currency: z.enum(CURRENCIES),
  problem: z.string().max(4000),
  solution: z.string().max(4000),
  scopeIncluded: z.string().max(4000),
  exclusions: z.string().max(4000),
  estimatedDelivery: z.string().max(200),
  paymentTerms: z.object({ type: z.enum(PAYMENT_TYPES), custom: z.string().max(2000) }),
  // WO-2026-00255 (revierte la decisión de Miguel del 2026-08-26 de fundir
  // «Guardar borrador»/«Crear cotización» en un solo botón — pedido explícito
  // de Miguel: quiere el botón separado de vuelta). `true` = "Crear
  // cotización" (avanza de borrador a lista); ausente/false = "Guardar
  // borrador" (se queda en borrador). Nunca retrocede un estado ya avanzado.
}).pick({ id: true, clientId: true, title: true, items: true, taxEnabled: true, notes: true, validUntil: true, currency: true, problem: true, solution: true, scopeIncluded: true, exclusions: true, estimatedDelivery: true, paymentTerms: true }).extend({ markReady: z.boolean().optional(), expectedVersion: z.number().int().min(1).optional() }).strict();
export type SaveQuoteInput = z.infer<typeof SaveQuoteSchema>;

