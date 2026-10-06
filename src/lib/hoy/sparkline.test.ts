import { describe, expect, it } from "vitest";
import { buildSparklinePath, buildBarRects } from "./sparkline";

describe("buildSparklinePath", () => {
  it("menos de 2 puntos no dibuja nada", () => {
    expect(buildSparklinePath([], 80, 28)).toBeNull();
    expect(buildSparklinePath([3], 80, 28)).toBeNull();
  });

  it("recorre todo el ancho dentro del alto con margen para el trazo", () => {
    const d = buildSparklinePath([0, 10], 80, 28, 2)!;
    expect(d).toBe("M1.00,27.00 L79.00,1.00");
  });

  it("serie plana queda centrada (no divide entre cero)", () => {
    const d = buildSparklinePath([5, 5, 5], 80, 28, 2)!;
    expect(d).not.toMatch(/NaN/);
    expect(d).toContain(",14.00");
  });
});

describe("buildBarRects", () => {
  it("barras ancladas a la base con 2px de separación", () => {
    const rects = buildBarRects([0, 5, 10], 80, 28, 2);
    expect(rects).toHaveLength(3);
    const width = (80 - 2 * 2) / 3;
    expect(rects[0].width).toBeCloseTo(width);
    expect(rects[1].x).toBeCloseTo(width + 2);
    expect(rects[2].height).toBe(28);
    expect(rects[2].y).toBe(0);
    // un cero se dibuja como base mínima visible, no desaparece
    expect(rects[0].height).toBeGreaterThan(0);
  });

  it("sin datos no hay barras", () => {
    expect(buildBarRects([], 80, 28)).toEqual([]);
  });
});
