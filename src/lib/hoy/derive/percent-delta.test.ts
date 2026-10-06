import { describe, expect, it } from "vitest";
import { pctDelta, buildDelta } from "./percent-delta";

describe("pctDelta", () => {
  it("variación redondeada", () => {
    expect(pctDelta(18, 16)).toBe(13);
    expect(pctDelta(3, 6)).toBe(-50);
    expect(pctDelta(5, 5)).toBe(0);
  });

  it("sin base (0 → n) no inventa un porcentaje", () => {
    expect(pctDelta(4, 0)).toBeNull();
    expect(pctDelta(0, 0)).toBe(0);
  });
});

describe("buildDelta", () => {
  it("subir leads es bueno", () => {
    expect(buildDelta(12, 9, "vs. ayer", "up-good")).toEqual({
      pct: 33,
      direction: "up",
      sentiment: "good",
      comparison: "vs. ayer",
    });
  });

  it("subir cobros por vencer es malo", () => {
    expect(buildDelta(6, 4, "vs. semana pasada", "up-bad")?.sentiment).toBe("bad");
    expect(buildDelta(2, 4, "vs. semana pasada", "up-bad")?.sentiment).toBe("good");
  });

  it("sin cambio es neutral y plano", () => {
    expect(buildDelta(3, 3, "vs. ayer", "up-good")).toMatchObject({ direction: "flat", sentiment: "neutral", pct: 0 });
  });

  it("sin base conserva dirección pero pct null", () => {
    expect(buildDelta(3, 0, "vs. ayer", "up-good")).toMatchObject({ pct: null, direction: "up" });
  });

  it("sin datos en ninguno de los dos periodos no hay delta", () => {
    expect(buildDelta(null, 2, "vs. ayer", "up-good")).toBeNull();
  });
});
