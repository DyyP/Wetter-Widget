import { describe, expect, it } from "vitest"
import { buildEventUrl, errorFromSunsethue, parseEvent, qualityLabel, qualityLevel } from "../Wetter/core/sunsethue"

// Beispielantwort aus der offiziellen Doku (sunsethue.com/dev-api)
const example = {
  time: "2026-02-22T20:23:23.349Z",
  location: { latitude: 41.4, longitude: 2.2 },
  grid_location: { latitude: 41.5, longitude: 2 },
  data: {
    type: "sunset",
    model_data: true,
    quality: 0.45,
    cloud_cover: 0.32,
    quality_text: "Good",
    time: "2026-02-22T17:32:00.000Z",
    direction: 256.7,
    magics: {
      blue_hour: ["2026-02-22T17:55:00.000Z", "2026-02-22T18:07:00.000Z"],
      golden_hour: ["2026-02-22T17:17:00.000Z", "2026-02-22T17:49:00.000Z"],
    },
  },
}

describe("buildEventUrl", () => {
  it("baut die Abfrage wie in der Doku", () => {
    expect(buildEventUrl({ lat: 41.4012, lon: 2.1987, date: "2026-02-22", type: "sunset" })).toBe(
      "https://api.sunsethue.com/event?latitude=41.4&longitude=2.2&date=2026-02-22&type=sunset",
    )
  })
})

describe("parseEvent", () => {
  it("liest die Beispielantwort", () => {
    const event = parseEvent(example, { date: "2026-02-22", type: "sunset" })
    expect(event).toEqual({
      type: "sunset",
      date: "2026-02-22",
      time: Date.UTC(2026, 1, 22, 17, 32),
      quality: 0.45,
      qualityText: "Good",
      cloudCover: 0.32,
      direction: 256.7,
      goldenHour: [Date.UTC(2026, 1, 22, 17, 17), Date.UTC(2026, 1, 22, 17, 49)],
      blueHour: [Date.UTC(2026, 1, 22, 17, 55), Date.UTC(2026, 1, 22, 18, 7)],
      modelData: true,
    })
  })

  it("akzeptiert fehlende Qualität ohne Modelldaten", () => {
    const event = parseEvent({ data: { type: "sunrise", model_data: false } }, { date: "2026-02-23", type: "sunrise" })
    expect(event.quality).toBeNull()
    expect(event.modelData).toBe(false)
  })

  it("lehnt falsche Typen und leere Antworten ab", () => {
    expect(() => parseEvent(example, { date: "2026-02-22", type: "sunrise" })).toThrow(/Ereignistyp/)
    expect(() => parseEvent({}, { date: "2026-02-22", type: "sunset" })).toThrow(/data/)
  })
})

describe("Bewertung", () => {
  it("übersetzt bekannte Texte und stuft sonst nach Wert ein", () => {
    expect(qualityLabel(0.45, "Good")).toBe("Gut")
    expect(qualityLabel(0.9, "Excellent")).toBe("Spitze")
    expect(qualityLabel(0.1, null)).toBe("Schwach")
    expect(qualityLabel(0.65, "Unbekannt")).toBe("Sehr gut")
  })

  it("ordnet Farbstufen wie im alten Widget zu", () => {
    expect(qualityLevel(0.7)).toBe("high")
    expect(qualityLevel(0.4)).toBe("medium")
    expect(qualityLevel(0.39)).toBe("low")
  })
})

describe("errorFromSunsethue", () => {
  it("erkennt das Tageslimit", () => {
    const error = errorFromSunsethue(400, { status: 400, code: 204, message: "Exceeded daily quota" })
    expect(error.quota).toBe(true)
    expect(error.message).toBe("Exceeded daily quota")
    expect(errorFromSunsethue(401, null).quota).toBe(false)
  })
})
