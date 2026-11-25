import { describe, expect, it } from "vitest"
import {
  MeteoblueError,
  buildBasicForecastUrl,
  creditsAccounted,
  errorFromResponse,
  parseBasicForecast,
  redactApiKey,
  toUtcMillis,
} from "../Wetter/core/meteoblue"
import synthetic from "./fixtures/meteoblue-basic.synthetic.json"

/** Tiefe Kopie der Fixture, die ein Test verändern darf */
function clone(): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(synthetic)) as Record<string, Record<string, unknown>>
}

describe("buildBasicForecastUrl", () => {
  it("fragt basic-1h und basic-day in einem Abruf ab, Ort auf 100 m gerundet", () => {
    const url = buildBasicForecastUrl("KEY123", { lat: 52.520008, lon: 13.404954 })
    expect(url).toBe(
      "https://my.meteoblue.com/packages/basic-1h,basic-day?apikey=KEY123&lat=52.52&lon=13.405&format=json&timeformat=Y-M-D&temperatureUnit=C&precipitationUnit=metric",
    )
  })

  it("lehnt fehlenden Key und ungültige Koordinaten ab", () => {
    expect(() => buildBasicForecastUrl("  ", { lat: 1, lon: 1 })).toThrow(/Key fehlt/)
    expect(() => buildBasicForecastUrl("k", { lat: 91, lon: 1 })).toThrow(/Koordinaten/)
    expect(() => buildBasicForecastUrl("k", { lat: Number.NaN, lon: 1 })).toThrow(/Koordinaten/)
  })
})

describe("redactApiKey", () => {
  it("entfernt den Key aus URLs und Fehlermeldungen", () => {
    expect(redactApiKey("Fehler bei https://x/p?lat=1&apikey=SECRET&lon=2")).toBe("Fehler bei https://x/p?lat=1&apikey=***&lon=2")
  })
})

describe("toUtcMillis", () => {
  it("rechnet Ortszeit mit dem Versatz der Antwort in UTC um", () => {
    expect(toUtcMillis("2026-11-25 14:00", 1)).toBe(Date.UTC(2026, 10, 25, 13, 0))
    expect(toUtcMillis("2026-07-01 00:30", 2)).toBe(Date.UTC(2026, 5, 30, 22, 30))
    expect(() => toUtcMillis("25.11.2026 14:00", 1)).toThrow(MeteoblueError)
  })
})

describe("parseBasicForecast", () => {
  const forecast = parseBasicForecast(synthetic)

  it("liest Ort, Stunden in UTC und Tage", () => {
    expect(forecast.latitude).toBe(52.52)
    expect(forecast.hourly).toHaveLength(4)
    expect(forecast.hourly[0]).toEqual({
      time: Date.UTC(2026, 10, 25, 13, 0),
      temperature: 6.8,
      feltTemperature: 3.9,
      precipitation: 0,
      pictocode: 4,
      isDaylight: true,
    })
    expect(forecast.hourly[3]?.isDaylight).toBe(false)
    expect(forecast.daily[1]).toEqual({ date: "2026-11-26", pictocode: 6, temperatureMax: 9.4, temperatureMin: 3.6, precipitation: 4.2 })
  })

  it("meldet fehlende Felder, falsche Längen und Fehlerantworten", () => {
    const missing = clone()
    delete missing["data_1h"]!["pictocode"]
    expect(() => parseBasicForecast(missing)).toThrow(/data_1h.pictocode/)
    const short = clone()
    short["data_1h"]!["temperature"] = [1, 2]
    expect(() => parseBasicForecast(short)).toThrow(/2 statt 4/)
    const text = clone()
    text["data_day"]!["temperature_max"] = [1, "x"]
    expect(() => parseBasicForecast(text)).toThrow(/temperature_max\[1\]/)
    expect(() => parseBasicForecast({ error: true, error_message: "Invalid apikey" })).toThrow("Invalid apikey")
  })
})

describe("Fehler und Credits", () => {
  it("ordnet HTTP-Status ein und übernimmt die API-Meldung", () => {
    const access = errorFromResponse(403, { error: true, error_message: "API key expired" })
    expect(access.kind).toBe("access")
    expect(access.message).toBe("API key expired")
    expect(errorFromResponse(429, null).kind).toBe("rate-limit")
    expect(errorFromResponse(503, "x").kind).toBe("server")
    expect(errorFromResponse(400, {}).message).toBe("HTTP 400")
  })

  it("liest MB-Credits-Accounted", () => {
    expect(creditsAccounted([["content-type", "json"], ["mb-credits-accounted", "8000"]])).toBe(8000)
    expect(creditsAccounted([["MB-Credits-Accounted", "4000"]])).toBe(4000)
    expect(creditsAccounted([["content-type", "json"]])).toBeNull()
  })
})
