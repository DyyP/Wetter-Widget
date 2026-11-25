import { describe, expect, it } from "vitest"
import { addDays, distanceKm, localDateString, roundCoordinates, weekday } from "../Wetter/core/geo"

describe("Koordinaten", () => {
  it("rundet auf etwa 100 m", () => {
    expect(roundCoordinates({ lat: 52.520008, lon: 13.404954 })).toEqual({ lat: 52.52, lon: 13.405 })
  })

  it("misst Entfernungen", () => {
    // Berlin – Hamburg Luftlinie etwa 255 km
    expect(distanceKm({ lat: 52.52, lon: 13.405 }, { lat: 53.551, lon: 9.994 })).toBeCloseTo(255, -1)
    expect(distanceKm({ lat: 49, lon: 8.4 }, { lat: 49, lon: 8.4 })).toBe(0)
  })
})

describe("Kalendertage", () => {
  it("rechnet über Monats- und Jahresgrenzen", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("kennt Wochentage und den lokalen Tag", () => {
    expect(weekday("2026-11-25")).toBe(3) // Mittwoch
    expect(localDateString(new Date(2026, 10, 25, 23, 59).getTime())).toBe("2026-11-25")
  })
})
