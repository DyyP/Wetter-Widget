import { describe, expect, it } from "vitest"
import { alertText, alertsFromResponse, buildAlertsUrl, parseAlerts, relevantAlerts } from "../Wetter/core/dwd"
import sample from "./fixtures/brightsky-alerts.sample.json"

const alerts = parseAlerts(sample)

describe("parseAlerts", () => {
  it("liest Warnungen und überspringt Testmeldungen", () => {
    expect(alerts.map((a) => a.event)).toEqual(["FROST", "ORKANBÖEN", "SCHWERES GEWITTER"])
    expect(alerts.map((a) => a.level)).toEqual([1, 4, 3])
    expect(alerts[1]?.onset).toBe(Date.parse("2026-11-25T14:00:00+01:00"))
  })

  it("lehnt Antworten ohne alerts ab", () => {
    expect(() => parseAlerts({})).toThrow()
  })
})

describe("relevantAlerts", () => {
  const morning = Date.parse("2026-11-25T09:00:00+01:00")

  it("zeigt nur Unwetter ab Stufe 3, höchste zuerst", () => {
    expect(relevantAlerts(alerts, morning).map((a) => a.event)).toEqual(["ORKANBÖEN", "SCHWERES GEWITTER"])
  })

  it("lässt abgelaufene und zu ferne Warnungen weg", () => {
    const evening = Date.parse("2026-11-25T19:00:00+01:00")
    expect(relevantAlerts(alerts, evening).map((a) => a.event)).toEqual(["SCHWERES GEWITTER"])
    const dayBefore = Date.parse("2026-11-24T09:00:00+01:00")
    expect(relevantAlerts(alerts, dayBefore - 6 * 3_600_000)).toEqual([])
  })

  it("kann auch niedrigere Stufen liefern", () => {
    expect(relevantAlerts(alerts, morning, 1)).toHaveLength(3)
  })
})

describe("alertText", () => {
  const [, orkan] = alerts

  it("nennt Beginn oder Ende", () => {
    if (orkan === undefined) throw new Error("Fixture fehlt")
    const before = orkan.onset - 3_600_000
    const during = orkan.onset + 3_600_000
    expect(alertText(orkan, before)).toMatch(/^ORKANBÖEN ab \d\d:\d\d$/)
    expect(alertText(orkan, during)).toMatch(/^ORKANBÖEN bis \d\d:\d\d$/)
    expect(alertText(orkan, orkan.onset - 30 * 3_600_000)).toMatch(/^ORKANBÖEN ab morgen \d\d:\d\d$/)
  })
})

describe("buildAlertsUrl", () => {
  it("baut die Bright-Sky-URL", () => {
    expect(buildAlertsUrl({ lat: 52.520008, lon: 13.404954 })).toBe("https://api.brightsky.dev/alerts?lat=52.52&lon=13.405")
  })
})

describe("alertsFromResponse", () => {
  it("liefert außerhalb Deutschlands keine Warnungen statt eines Fehlers", () => {
    // Antwort von Bright Sky für Wien, geprüft 11/2026
    expect(alertsFromResponse(404, { detail: "Requested position is not covered by the DWD" })).toEqual([])
  })

  it("meldet andere Fehler weiter", () => {
    expect(() => alertsFromResponse(404, { detail: "Not Found" })).toThrow("HTTP 404")
    expect(() => alertsFromResponse(503, null)).toThrow("HTTP 503")
  })

  it("liest eine normale Antwort", () => {
    expect(alertsFromResponse(200, sample)).toEqual(alerts)
  })
})
