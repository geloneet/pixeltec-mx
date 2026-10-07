/**
 * Tipos de /hoy «Centro Comercial» (WO-2026-00515).
 *
 * Frontera servidor → UI: todo `Date` viaja como ISO 8601 (string) y todo
 * importe viaja ya formateado (`*Text`) junto a su valor numérico cuando la UI
 * lo necesita. `null` = sin dato: la UI muestra un estado vacío honesto, nunca
 * `$0`, `NaN` ni `undefined`.
 */

/** Resultado de un loader aislado: un widget caído no tumba la página. */
export type WidgetResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type Tone = "blue" | "violet" | "amber" | "orange" | "red" | "emerald" | "slate";

// ── KPIs ─────────────────────────────────────────────────────────────────────

export type KpiId = "leads" | "seguimientos" | "cotizaciones" | "cobros" | "cobrado";

export interface KpiDelta {
  /** Variación porcentual redondeada; `null` cuando no hay base (0 → n). */
  pct: number | null;
  direction: "up" | "down" | "flat";
  /** Si subir es bueno (leads) o malo (cobros por vencer). */
  sentiment: "good" | "bad" | "neutral";
  /** «vs. ayer», «vs. semana pasada», «vs. mes anterior»… */
  comparison: string;
}

export interface KpiCard {
  id: KpiId;
  label: string;
  /** Valor ya formateado; `null` = sin dato. */
  valueText: string | null;
  delta: KpiDelta | null;
  /** Serie diaria (7 días, el último es hoy) para el sparkline. */
  series: number[];
  chart: "line" | "bars";
  tone: Tone;
  href: string;
  /** Descripción accesible de la serie (sr-only). */
  seriesLabel: string;
}

// ── Prioridades ──────────────────────────────────────────────────────────────

export type PriorityStatus = "pago_vencido" | "pago_pendiente" | "seguimiento" | "cotizacion_enviada";
export type Channel = "whatsapp" | "correo";

export interface PriorityRow {
  id: string;
  /** Id público del cliente (firestore_id ?? uuid), el que usa /clientes/[id]. */
  clientId: string;
  clientName: string;
  logoUrl: string | null;
  color: string | null;
  clientCrmStatus: string;
  channel: Channel | null;
  message: string | null;
  messageAt: string | null;
  status: PriorityStatus;
  amountText: string | null;
  nextAction: { label: string; dueAt: string | null } | null;
  cta: { label: string; href: string };
  /** 0 = más urgente. */
  rank: number;
}

// ── Checklist ────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  label: string;
  /** ISO de la hora comprometida; `null` = «Todo el día». */
  at: string | null;
  done: boolean;
  href: string;
}

// ── Cobros y pagos ───────────────────────────────────────────────────────────

export interface CobroRow {
  id: string;
  clientName: string;
  concept: string;
  amountText: string;
  dueDate: string;
  chip: { label: string; tone: Tone };
}

// ── Alertas ──────────────────────────────────────────────────────────────────

export type AlertKind = "sin_respuesta" | "cotizacion_abierta" | "lead_contacto" | "cobro_vencido" | "notificacion";

export interface AlertRow {
  id: string;
  kind: AlertKind;
  title: string;
  description: string;
  at: string | null;
  tone: Tone;
  href: string;
}

// ── Pipeline ─────────────────────────────────────────────────────────────────

export type PipelineStageId =
  | "nuevo_lead"
  | "contactado"
  | "en_seguimiento"
  | "cotizacion_enviada"
  | "negociacion"
  | "pago_pendiente"
  | "cerrado";

export interface PipelineCard {
  id: string;
  name: string;
  amountText: string | null;
  href: string;
}

export interface PipelineColumn {
  id: PipelineStageId;
  label: string;
  tone: Tone;
  count: number;
  cards: PipelineCard[];
  /** Tarjetas no mostradas («+N más»). */
  more: number;
}

// ── Actividad ────────────────────────────────────────────────────────────────

export type ActivityKind = "whatsapp" | "correo" | "cotizacion" | "cobro" | "lead" | "cliente";
export type ActivityFilter = "todas" | "whatsapp" | "correo" | "cotizaciones" | "cobros";

export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  title: string;
  subtitle: string | null;
  /** Importe ya formateado, solo con dato real (WO-2026-00519); si no, ausente/null. */
  amount?: string | null;
  at: string;
  href: string;
}

// ── Conversaciones (PixelBot, solo lectura) ──────────────────────────────────

export type ConversationsStatus = "ok" | "unavailable" | "not_allowed";

export interface HoyDashboard {
  greetingName: string | null;
  dateLabel: string;
  nowIso: string;
  conversationsStatus: ConversationsStatus;
  kpis: WidgetResult<KpiCard[]>;
  prioridades: WidgetResult<{ rows: PriorityRow[]; total: number }>;
  checklist: WidgetResult<ChecklistItem[]>;
  cobros: WidgetResult<CobroRow[]>;
  alertas: WidgetResult<{ rows: AlertRow[]; total: number }>;
  pipeline: WidgetResult<{ columns: PipelineColumn[]; total: number }>;
  actividad: WidgetResult<ActivityRow[]>;
}
