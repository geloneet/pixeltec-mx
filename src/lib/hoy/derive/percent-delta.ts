import type { KpiDelta } from "@/lib/hoy/types";

/**
 * Variación porcentual entera. `0 → n` no tiene base: devuelve `null` y la UI
 * muestra «sin base» en lugar de un «+100 %» inventado.
 */
export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

export function buildDelta(
  current: number | null,
  previous: number | null,
  comparison: string,
  polarity: "up-good" | "up-bad",
): KpiDelta | null {
  if (current === null || previous === null) return null;
  const pct = pctDelta(current, previous);
  const direction = current > previous ? "up" : current < previous ? "down" : "flat";
  const sentiment =
    direction === "flat"
      ? "neutral"
      : (direction === "up") === (polarity === "up-good")
        ? "good"
        : "bad";
  return { pct, direction, sentiment, comparison };
}
