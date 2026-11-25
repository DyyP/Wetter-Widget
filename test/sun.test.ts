import { describe, expect, it } from "vitest"
import { sunTimes } from "../Wetter/core/sun"

/** Abweichung in Minuten zwischen berechneter und erwarteter UTC-Zeit */
function minutesOff(actual: number | null, expectedUtc: number): number {
  if (actual === null) return Number.POSITIVE_INFINITY
  return Math.abs(actual - expectedUtc) / 60_000
}

// Referenzwerte für Berlin (52.52 N, 13.405 E), z. B. timeanddate.com
describe("sunTimes", () => {
  it("Sommersonnenwende in Berlin", () => {
    const t = sunTimes("2026-06-21", 52.52, 13.405)
    expect(minutesOff(t.sunrise, Date.UTC(2026, 5, 21, 2, 43))).toBeLessThan(3)
    expect(minutesOff(t.sunset, Date.UTC(2026, 5, 21, 19, 33))).toBeLessThan(3)
  })

  it("Wintersonnenwende in Berlin", () => {
    const t = sunTimes("2026-12-21", 52.52, 13.405)
    expect(minutesOff(t.sunrise, Date.UTC(2026, 11, 21, 7, 15))).toBeLessThan(3)
    expect(minutesOff(t.sunset, Date.UTC(2026, 11, 21, 14, 54))).toBeLessThan(3)
  })

  it("Ende November in Berlin (Referenz: NOAA-Verfahren)", () => {
    const t = sunTimes("2026-11-25", 52.52, 13.405)
    expect(minutesOff(t.sunrise, Date.UTC(2026, 10, 25, 6, 45))).toBeLessThan(3)
    expect(minutesOff(t.sunset, Date.UTC(2026, 10, 25, 15, 1))).toBeLessThan(3)
  })

  it("liefert den Tag am Ort, auch westlich von Greenwich", () => {
    // New York, 1. März: Aufgang ca. 06:30 EST = 11:30 UTC, Untergang ca. 17:50 EST = 22:50 UTC
    const t = sunTimes("2026-03-01", 40.7128, -74.006)
    expect(minutesOff(t.sunrise, Date.UTC(2026, 2, 1, 11, 31))).toBeLessThan(4)
    expect(minutesOff(t.sunset, Date.UTC(2026, 2, 1, 22, 50))).toBeLessThan(4)
  })

  it("erkennt Polarnacht und Polartag", () => {
    expect(sunTimes("2026-12-21", 78.22, 15.65)).toEqual({ sunrise: null, sunset: null })
    expect(sunTimes("2026-06-21", 78.22, 15.65)).toEqual({ sunrise: null, sunset: null })
  })

  it("lehnt ungültige Daten ab", () => {
    expect(() => sunTimes("21.12.2026", 52, 13)).toThrow()
  })
})
