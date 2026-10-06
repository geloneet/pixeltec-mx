/**
 * Ventanas de fecha de /hoy en la zona del negocio (America/Mexico_City).
 *
 * Puro: sin `db` ni `next`. El servidor corre en UTC; «hoy» para Miguel es el
 * día calendario de CDMX. Todas las comparaciones por día usan claves
 * `YYYY-MM-DD` de esa zona (ordenan igual lexicográfica y cronológicamente).
 */
export const HOY_TIME_ZONE = "America/Mexico_City";

const DAY_MS = 86_400_000;

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: HOY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: HOY_TIME_ZONE,
  timeZoneName: "longOffset",
});

/** Clave `YYYY-MM-DD` del día calendario en CDMX. */
export function zonedDayKey(date: Date): string {
  return dayKeyFormatter.format(date);
}

/** Desfase (minutos) de CDMX respecto a UTC en ese instante (p. ej. -360). */
function zoneOffsetMinutes(date: Date): number {
  const part = offsetFormatter.formatToParts(date).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(part);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Instante UTC de la medianoche CDMX de la clave dada. */
export function keyToZonedStart(key: string): Date {
  const utcMidnight = new Date(`${key}T00:00:00Z`);
  const offset = zoneOffsetMinutes(new Date(utcMidnight.getTime() + 12 * 3_600_000));
  return new Date(utcMidnight.getTime() - offset * 60_000);
}

export function startOfZonedDay(date: Date): Date {
  return keyToZonedStart(zonedDayKey(date));
}

export function startOfZonedMonth(date: Date): Date {
  return keyToZonedStart(`${zonedDayKey(date).slice(0, 7)}-01`);
}

export function addDaysToKey(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** `a - b` en días calendario. */
export function diffDayKeys(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / DAY_MS);
}

/** Las últimas `n` claves terminando en `endKey` (inclusive), de la más vieja a la más nueva. */
export function lastNDayKeys(endKey: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDaysToKey(endKey, i - (n - 1)));
}

/** Clave de día CDMX de un ISO/Date, o `null` si no es fecha válida. Acepta `YYYY-MM-DD` tal cual. */
export function toDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : zonedDayKey(d);
}

const longDateFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: HOY_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** «Martes, 6 de octubre de 2026». */
export function formatLongDateEs(date: Date): string {
  const text = longDateFormatter.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: HOY_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

/** «11:00 a.m.» en hora de CDMX. */
export function formatTimeEs(value: string | Date): string | null {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return timeFormatter.format(d).replace(/ | /g, " ");
}

const shortDayFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: HOY_TIME_ZONE,
  day: "numeric",
  month: "short",
});

/** «Hoy, 11:00 a.m.» · «Mañana, 10:00 a.m.» · «Ayer» · «8 oct». */
export function formatDueEs(value: string | null, now: Date): string | null {
  if (!value) return null;
  const key = toDayKey(value);
  if (!key) return null;
  const diff = diffDayKeys(key, zonedDayKey(now));
  const hasTime = !/^\d{4}-\d{2}-\d{2}$/.test(value);
  const time = hasTime ? formatTimeEs(value) : null;
  const day =
    diff === 0
      ? "Hoy"
      : diff === 1
        ? "Mañana"
        : diff === -1
          ? "Ayer"
          : shortDayFormatter.format(keyToZonedStart(key)).replace(".", "");
  return time ? `${day}, ${time}` : day;
}

/** «Hace 25 min», «Hace 1 hora», «Hace 2 días»; `null` si la fecha no es válida. */
export function formatRelativeEs(value: string | Date | null, now: Date): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return "Hace un momento";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} ${days === 1 ? "día" : "días"}`;
}
