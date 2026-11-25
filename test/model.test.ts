import { describe, expect, it } from "vitest"
import type { Alert } from "../Wetter/core/dwd"
import type { Forecast } from "../Wetter/core/meteoblue"
import { buildModel, formatRain, modelIconNames, roundTemperature, type HourSlot, type SunSlot } from "../Wetter/core/model"
import type { SunEvent } from "../Wetter/core/sunsethue"

// Testzeitzone Europe/Berlin, 25.11.2026 ist ein Mittwoch. Ort: Berlin.
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const NOW = local(25, 15, 20)

function forecast(): Forecast {
  const hourly = Array.from({ length: 48 }, (_, i) => ({
    time: local(25, i),
    temperature: 6 - i * 0.1,
    feltTemperature: 3 - i * 0.1,
    precipitation: i === 17 ? 0.44 : i === 18 ? 0.04 : 0,
    pictocode: i === 16 ? 7 : 22,
    isDaylight: i >= 8 && i < 16,
  }))
  const daily = ["2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01"].map(
    (date, i) => ({
      date,
      pictocode: i + 1,
      temperatureMax: 8.4 - i,
      temperatureMin: 1.6 - i,
      precipitation: i === 1 ? 4.24 : 0,
    }),
  )
  return { latitude: 52.52, longitude: 13.405, hourly, daily }
}

function sunset(date: string, time: number, quality: number): SunEvent {
  return { type: "sunset", date, time, quality, qualityText: "Good" }
}

const base = { now: NOW, forecast: forecast(), fetchedAt: local(25, 12, 5), sunEvents: [] as SunEvent[], alerts: [] as Alert[] }

function model(overrides: Partial<typeof base> = {}) {
  const result = buildModel({ ...base, ...overrides })
  if (!result.ok) throw new Error(`kein Modell: ${result.reason}`)
  return result.model
}

describe("Stunden-Slots", () => {
  it("beginnt mit JETZT und fügt den Sonnenuntergang in die Zeitleiste ein", () => {
    // Sonnenuntergang Berlin am 25.11.: 16:01 MEZ (NOAA)
    const m = model({ sunEvents: [sunset("2026-11-25", local(25, 16, 1), 0.72)] })
    expect(m.slots.map((s) => s.label)).toEqual(["JETZT", "16:00", "16:01", "17:00", "18:00", "19:00"])
    const sun = m.slots[2] as SunSlot
    expect(sun).toMatchObject({ kind: "sun", type: "sunset", quality: 0.72, qualityLabel: "Gut", level: "high" })
    // Wetter der Stunde 16:00 (Code 7) als Tag-Variante, die Stunde selbst ist schon Nacht
    expect(sun.icon).toBe("07_day.svg")
    expect(m.slots[1]).toMatchObject({ kind: "hour", icon: "07_night.svg" })
  })

  it("berechnet den Sonnenuntergang selbst, wenn Sunsethue fehlt", () => {
    const sun = model().slots.find((s) => s.kind === "sun") as SunSlot
    expect(sun.label).toMatch(/^16:0\d$/)
    expect(sun.quality).toBeNull()
    expect(sun.level).toBeNull()
  })

  it("zeigt Temperaturen, gefühlte Werte, Regen und Tag/Nacht-Icons", () => {
    const hours = model().slots.filter((s): s is HourSlot => s.kind === "hour")
    expect(hours[0]).toMatchObject({ isNow: true, icon: "22_day.svg", temperature: 5, feltTemperature: 2, rain: null })
    const h17 = hours.find((h) => h.label === "17:00")
    expect(h17).toMatchObject({ icon: "22_night.svg", rain: "0.4" })
    expect(hours.find((h) => h.label === "18:00")?.rain).toBeNull()
  })

  it("rollt ohne neuen Abruf weiter", () => {
    expect(model({ now: local(25, 21, 5) }).slots[0]?.label).toBe("JETZT")
    expect(model({ now: local(25, 21, 5) }).slots.map((s) => s.label).slice(1, 3)).toEqual(["22:00", "23:00"])
  })

  it("zeigt kein Sonnenereignis, das außerhalb der Zeitleiste liegt", () => {
    expect(model({ now: local(25, 20, 0) }).slots.some((s) => s.kind === "sun")).toBe(false)
  })
})

describe("Regenzeilen", () => {
  it("erscheinen nur, wenn es in der Reihe regnet oder ein Sonnen-Slot da ist", () => {
    // 15:20: Sonnenuntergang 16:0x sichtbar, Regen erst ab 17 Uhr in der Reihe
    expect(model()).toMatchObject({ hourRainRow: true, dayRainRow: true })
    // 21:05: kein Sonnen-Slot, kein Regen in den nächsten Stunden
    expect(model({ now: local(25, 21, 5) }).hourRainRow).toBe(false)
  })

  it("entfallen in der Tagesreihe ohne Regen", () => {
    const dry = forecast()
    dry.daily = dry.daily.map((d) => ({ ...d, precipitation: 0 }))
    expect(model({ forecast: dry }).dayRainRow).toBe(false)
  })
})

describe("Tage", () => {
  it("zeigt 5 Tage ab heute mit deutschen Namen", () => {
    const m = model({ sunEvents: [sunset("2026-11-26", local(26, 15, 56), 0.3)] })
    expect(m.days.map((d) => d.label)).toEqual(["HEUTE", "DO", "FR", "SA", "SO"])
    expect(m.days[0]).toMatchObject({ icon: "01_iday.svg", max: 8, min: 2, rain: null, sunsetLevel: null })
    expect(m.days[1]).toMatchObject({ rain: "4.2mm", sunsetLevel: "low" })
  })

  it("beginnt nach Mitternacht beim neuen Tag", () => {
    expect(model({ now: local(26, 0, 30) }).days[0]?.label).toBe("HEUTE")
    expect(model({ now: local(26, 0, 30) }).days[1]?.label).toBe("FR")
  })
})

describe("Warnung und Hinweise", () => {
  const orkan: Alert = { level: 4, event: "ORKANBÖEN", onset: local(25, 14), expires: local(25, 18) }

  it("zeigt eine Unwetterwarnung ab Stufe 3", () => {
    expect(model({ alerts: [orkan] }).warning).toEqual({ text: "ORKANBÖEN bis 18:00", level: 4 })
    expect(model({ alerts: [{ ...orkan, level: 2 }] }).warning).toBeNull()
  })

  it("weist auf alte Daten hin", () => {
    expect(model().staleHint).toBeNull()
    expect(model({ fetchedAt: local(24, 17, 2) }).staleHint).toBe("Stand gestern 17:02")
  })

  it("listet die benötigten Icons", () => {
    const m = model()
    expect(modelIconNames(m)).toHaveLength(m.slots.length + m.days.length)
    expect(modelIconNames(m)).toContain("01_iday.svg")
  })

  it("plant die nächste volle Stunde", () => {
    expect(model().nextRefresh).toBe(local(25, 16))
  })
})

describe("ohne brauchbare Daten", () => {
  it("meldet fehlende oder veraltete Daten", () => {
    expect(buildModel({ ...base, forecast: null })).toEqual({ ok: false, reason: "no-data" })
    expect(buildModel({ ...base, now: local(28, 12) })).toEqual({ ok: false, reason: "outdated" })
  })
})

describe("Hilfsfunktionen", () => {
  it("formatiert Regen und Temperatur wie bisher", () => {
    expect(formatRain(0.04)).toBeNull()
    expect(formatRain(0.05)).toBe("0.1")
    expect(formatRain(12.34, "mm")).toBe("12.3mm")
    expect(roundTemperature(-0.4)).toBe(0)
    expect(Object.is(roundTemperature(-0.4), -0)).toBe(false)
    expect(roundTemperature(-2.6)).toBe(-3)
  })

})
