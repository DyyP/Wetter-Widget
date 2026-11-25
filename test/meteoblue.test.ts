import { describe, expect, it } from "vitest"
import {
  BASIC_CALL_CREDITS,
  MeteoblueError,
  buildBasicForecastUrl,
  errorFromResponse,
  parseBasicForecast,
  readCreditHeaders,
  redactApiKey,
  roundCoordinate,
  toUtcMillis,
} from "../Wetter/core/meteoblue"
import synthetic from "./fixtures/meteoblue-basic.synthetic.json"

describe("buildBasicForecastUrl", () => {
  it("fragt basic-1h und basic-day in einem Abruf ab", () => {
    const url = buildBasicForecastUrl("KEY123", { lat: 52.520008, lon: 13.404954 })
    expect(url.startsWith("https://my.meteoblue.com/packages/basic-1h,basic-day?")).toBe(true)
    expect(url).toContain("apikey=KEY123")
    expect(url).toContain("lat=52.52&lon=13.405")
    expect(url).toContain("timeformat=Y-M-D")
    expect(url).toContain("windSpeedUnit=km%2Fh")
    expect(url).not.toContain("forecastDays")
    expect(url).not.toContain("tz=")
  })

  it("übernimmt Höhe und Vorhersagetage", () => {
    const url = buildBasicForecastUrl("k", { lat: 47.5, lon: 8.2, asl: 412.6, forecastDays: 3 })
    expect(url).toContain("asl=413")
    expect(url).toContain("forecastDays=3")
  })

  it("lehnt fehlenden Key und ungültige Koordinaten ab", () => {
    expect(() => buildBasicForecastUrl("  ", { lat: 1, lon: 1 })).toThrow(/Key fehlt/)
    expect(() => buildBasicForecastUrl("k", { lat: 91, lon: 1 })).toThrow(/Koordinaten/)
    expect(() => buildBasicForecastUrl("k", { lat: Number.NaN, lon: 1 })).toThrow(/Koordinaten/)
  })

  it("kostet laut Referenz 8000 Credits", () => {
    expect(BASIC_CALL_CREDITS).toBe(8000)
  })
})

describe("redactApiKey", () => {
  it("entfernt den Key aus einer URL", () => {
    const url = "https://my.meteoblue.com/packages/basic-1h?lat=1&apikey=SECRET&lon=2"
    expect(redactApiKey(url)).toBe("https://my.meteoblue.com/packages/basic-1h?lat=1&apikey=***&lon=2")
  })
})

describe("roundCoordinate", () => {
  it("rundet auf etwa 100 m", () => {
    expect(roundCoordinate(52.520008)).toBe(52.52)
    expect(roundCoordinate(13.404954)).toBe(13.405)
    expect(roundCoordinate(-0.0004)).toBe(-0)
  })
})

describe("toUtcMillis", () => {
  it("rechnet Ortszeit mit dem Versatz der Antwort in UTC um", () => {
    expect(toUtcMillis("2026-11-25 14:00", 1)).toBe(Date.UTC(2026, 10, 25, 13, 0))
    expect(toUtcMillis("2026-07-01 00:30", 2)).toBe(Date.UTC(2026, 5, 30, 22, 30))
  })

  it("akzeptiert UTC-Zeitstempel in Sekunden und Millisekunden", () => {
    expect(toUtcMillis(1_795_600_000, 1)).toBe(1_795_600_000_000)
    expect(toUtcMillis(1_795_600_000_000, 1)).toBe(1_795_600_000_000)
  })

  it("lehnt unbekannte Formate ab", () => {
    expect(() => toUtcMillis("25.11.2026 14:00", 1)).toThrow(MeteoblueError)
  })
})

/** Tiefe Kopie der Fixture, die ein Test verändern darf. */
function clone(): Record<string, Record<string, unknown>> {
  return JSON.parse(JSON.stringify(synthetic)) as Record<string, Record<string, unknown>>
}

describe("parseBasicForecast", () => {
  const forecast = parseBasicForecast(synthetic)

  it("liest Metadaten", () => {
    expect(forecast.latitude).toBe(52.52)
    expect(forecast.utcOffsetHours).toBe(1)
    expect(forecast.timezoneAbbreviation).toBe("CET")
    expect(forecast.modelRunUpdateUtc).toBe("2026-11-25 05:43")
  })

  it("liest Stundenwerte mit UTC-Zeit", () => {
    expect(forecast.hourly).toHaveLength(4)
    expect(forecast.hourly[0]).toEqual({
      time: Date.UTC(2026, 10, 25, 13, 0),
      temperature: 6.8,
      feltTemperature: 3.9,
      precipitation: 0,
      precipitationProbability: 5,
      pictocode: 4,
      isDaylight: true,
    })
    expect(forecast.hourly[3]?.isDaylight).toBe(false)
  })

  it("liest Tageswerte", () => {
    expect(forecast.daily).toHaveLength(2)
    expect(forecast.daily[1]).toEqual({
      date: "2026-11-26",
      pictocode: 6,
      temperatureMax: 9.4,
      temperatureMin: 3.6,
      precipitation: 4.2,
      precipitationProbability: 90,
      predictability: 61,
      predictabilityClass: 4,
    })
  })

  it("kommt ohne optionale Reihen aus", () => {
    const copy = clone()
    delete copy["data_1h"]!["precipitation_probability"]
    delete copy["data_day"]!["predictability"]
    const parsed = parseBasicForecast(copy)
    expect(parsed.hourly[0]?.precipitationProbability).toBeNull()
    expect(parsed.daily[0]?.predictability).toBeNull()
  })

  it("meldet fehlende Pflichtfelder als Formatfehler", () => {
    const copy = clone()
    delete copy["data_1h"]!["pictocode"]
    expect(() => parseBasicForecast(copy)).toThrow(/data_1h.pictocode/)
  })

  it("meldet abweichende Reihenlängen", () => {
    const copy = clone()
    copy["data_1h"]!["temperature"] = [1, 2]
    expect(() => parseBasicForecast(copy)).toThrow(/2 statt 4/)
  })

  it("erkennt eine Fehlerantwort im Rumpf", () => {
    expect(() => parseBasicForecast({ error: true, error_message: "Invalid apikey" })).toThrow("Invalid apikey")
  })
})

describe("errorFromResponse", () => {
  it("ordnet HTTP-Status ein und übernimmt die API-Meldung", () => {
    const access = errorFromResponse(403, { error: true, error_message: "API key expired" })
    expect(access.kind).toBe("access")
    expect(access.message).toBe("API key expired")
    expect(errorFromResponse(401, null).kind).toBe("access")
    expect(errorFromResponse(429, null).kind).toBe("rate-limit")
    expect(errorFromResponse(503, "x").kind).toBe("server")
    expect(errorFromResponse(400, {}).message).toBe("HTTP 400")
  })
})

describe("readCreditHeaders", () => {
  it("bevorzugt MB-Credits-Accounted", () => {
    const result = readCreditHeaders([
      ["Content-Type", "application/json"],
      ["MB-Credits-Accounted", "8000"],
      ["MB-Credits-Remaining", "9984000"],
    ])
    expect(result.accounted).toBe(8000)
    expect(result.all).toEqual({ "mb-credits-accounted": "8000", "mb-credits-remaining": "9984000" })
  })

  it("nimmt sonst den ersten Credit-Header mit Zahl", () => {
    expect(readCreditHeaders([["x-credits-used", "4000"]]).accounted).toBe(4000)
  })

  it("liefert null ohne Credit-Header", () => {
    expect(readCreditHeaders([["content-type", "application/json"]])).toEqual({ accounted: null, all: {} })
  })
})
