/**
 * Geometría pura de los sparklines de los KPI (WO-2026-00515). SVG inline
 * server-rendered: sin recharts (cliente y pesado) para 5 micro-gráficas.
 */

/** Path de línea; `null` con menos de 2 puntos (no se dibuja). */
export function buildSparklinePath(values: number[], width: number, height: number, stroke = 2): string | null {
  if (values.length < 2) return null;
  const pad = stroke / 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerW = width - stroke;
  const innerH = height - stroke;
  const step = innerW / (values.length - 1);
  return values
    .map((v, i) => {
      const x = pad + i * step;
      const y = span === 0 ? height / 2 : pad + innerH - ((v - min) / span) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Barras ancladas a la base con `gap` px entre ellas; un cero conserva 2px visibles. */
export function buildBarRects(values: number[], width: number, height: number, gap = 2): BarRect[] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 0);
  const barW = (width - gap * (values.length - 1)) / values.length;
  const minH = 2;
  return values.map((v, i) => {
    const h = max <= 0 ? minH : Math.max(minH, (Math.max(v, 0) / max) * height);
    return { x: i * (barW + gap), y: height - h, width: barW, height: h };
  });
}
