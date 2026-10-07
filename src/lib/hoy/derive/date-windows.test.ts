import { describe, expect, it } from "vitest";
import {
  HOY_TIME_ZONE,
  zonedDayKey,
  startOfZonedDay,
  addDaysToKey,
  lastNDayKeys,
  diffDayKeys,
  formatLongDateEs,
  formatTimeEs,
  formatRelativeEs,
  formatDayEs,
  startOfZonedMonth,
} from "./date-windows";

describe("ventanas de fecha en America/Mexico_City", () => {
  it("usa la zona de México", () => {
    expect(HOY_TIME_ZONE).toBe("America/Mexico_City");
  });

  it("el día calendario es el de México, no el de UTC", () => {
    // 2026-10-07 03:00 UTC = 2026-10-06 21:00 en CDMX (UTC-6)
    expect(zonedDayKey(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-06");
    expect(zonedDayKey(new Date("2026-10-07T07:00:00Z"))).toBe("2026-10-07");
  });

  it("inicio del día en México como instante UTC", () => {
    expect(startOfZonedDay(new Date("2026-10-07T03:00:00Z")).toISOString()).toBe("2026-10-06T06:00:00.000Z");
  });

  it("inicio de mes en México", () => {
    expect(startOfZonedMonth(new Date("2026-10-06T18:00:00Z")).toISOString()).toBe("2026-10-01T06:00:00.000Z");
  });

  it("aritmética de días sobre claves", () => {
    expect(addDaysToKey("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDayKeys("2026-10-09", "2026-10-06")).toBe(3);
    expect(lastNDayKeys("2026-10-06", 3)).toEqual(["2026-10-04", "2026-10-05", "2026-10-06"]);
  });

  it("fecha larga en español con mayúscula inicial", () => {
    expect(formatLongDateEs(new Date("2026-10-06T18:00:00Z"))).toBe("Martes, 6 de octubre de 2026");
  });

  it("hora en formato del mockup", () => {
    expect(formatTimeEs("2026-10-06T17:00:00Z")).toMatch(/^11:00\s?a\.?\s?m\.?$/i);
  });

  it("tiempo relativo «Hace X»", () => {
    const now = new Date("2026-10-06T18:00:00Z");
    expect(formatRelativeEs("2026-10-06T17:35:00Z", now)).toBe("Hace 25 min");
    expect(formatRelativeEs("2026-10-06T17:00:00Z", now)).toBe("Hace 1 hora");
    expect(formatRelativeEs("2026-10-06T14:00:00Z", now)).toBe("Hace 4 horas");
    expect(formatRelativeEs("2026-10-04T18:00:00Z", now)).toBe("Hace 2 días");
    expect(formatRelativeEs("2026-10-06T17:59:40Z", now)).toBe("Hace un momento");
    expect(formatRelativeEs("no-es-fecha", now)).toBeNull();
  });
});

describe("formatDayEs (solo día, WO-2026-00519)", () => {
  const now = new Date("2026-10-06T18:00:00Z"); // martes 6 oct, 12:00 CDMX
  it("mismo día CDMX ⇒ «Hoy»; día anterior ⇒ «Ayer»; más viejo ⇒ fecha corta", () => {
    expect(formatDayEs("2026-10-06T18:00:00Z", now)).toBe("Hoy");
    expect(formatDayEs("2026-10-05T18:00:00Z", now)).toBe("Ayer");
    expect(formatDayEs("2026-10-03T18:00:00Z", now)).toBe("3 oct");
  });
  it("usa el día de CDMX, no el UTC", () => {
    // 2026-10-06 03:00 UTC = 5 oct 21:00 CDMX ⇒ «Ayer»
    expect(formatDayEs("2026-10-06T03:00:00Z", now)).toBe("Ayer");
  });
  it("valor inválido o ausente ⇒ null", () => {
    expect(formatDayEs("no-es-fecha", now)).toBeNull();
    expect(formatDayEs(null, now)).toBeNull();
  });
});
