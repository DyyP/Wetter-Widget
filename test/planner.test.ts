import { describe, expect, it } from "vitest"
import {
  EMPTY_METEOBLUE,
  EMPTY_SOURCE,
  METEOBLUE_PLAN,
  decideMeteoblue,
  decideSunsethue,
  decideWarnings,
  lastSlotStart,
  meteoblueSuccess,
  sourceFailure,
  type Context,
  type MeteoblueState,
} from "../Wetter/core/planner"

// Testzeitzone Europe/Berlin (siehe vitest.config.ts), November = UTC+1
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const HOME = { lat: 49.0, lon: 8.4 }
const HOUR = 3_600_000

const ctx = (now: number, extra: Partial<Context> = {}): Context => ({ now, here: HOME, hasData: true, trigger: "schedule", ...extra })
const state = (partial: Partial<MeteoblueState>): MeteoblueState => ({ ...EMPTY_METEOBLUE, location: HOME, ...partial })
/** Zustand nach einem erfolgreichen Abruf zu `time` */
const fetchedAt = (time: number, calls: number[] = [time]) => state({ lastSuccess: time, billedCalls: calls })

describe("lastSlotStart", () => {
  it("findet das letzte Zeitfenster 06/12/17 Uhr", () => {
    expect(lastSlotStart(at(25, 9, 30), [6, 12, 17])).toBe(at(25, 6))
    expect(lastSlotStart(at(25, 12, 0), [6, 12, 17])).toBe(at(25, 12))
    expect(lastSlotStart(at(25, 23, 0), [6, 12, 17])).toBe(at(25, 17))
    expect(lastSlotStart(at(25, 5, 59), [6, 12, 17])).toBe(at(24, 17))
  })
})

describe("decideMeteoblue", () => {
  it("ruft ohne Daten sofort ab, auch wenn nur der Cache fehlt", () => {
    expect(decideMeteoblue(EMPTY_METEOBLUE, ctx(at(25, 3)))).toEqual({ fetch: true, reason: "no-data" })
    expect(decideMeteoblue(fetchedAt(at(25, 6, 5)), ctx(at(25, 7), { hasData: false }))).toEqual({ fetch: true, reason: "no-data" })
  })

  it("ruft einmal pro Zeitfenster ab", () => {
    const fresh = fetchedAt(at(25, 6, 5))
    expect(decideMeteoblue(fresh, ctx(at(25, 11, 50)))).toEqual({ fetch: false, reason: "up-to-date" })
    expect(decideMeteoblue(fresh, ctx(at(25, 12, 1)))).toEqual({ fetch: true, reason: "slot" })
  })

  it("holt ein verpasstes Fenster nach, aber nur einmal", () => {
    expect(decideMeteoblue(fetchedAt(at(24, 17, 10)), ctx(at(25, 14)))).toEqual({ fetch: true, reason: "slot" })
    const caughtUp = fetchedAt(at(25, 14), [at(24, 17, 10), at(25, 14)])
    expect(decideMeteoblue(caughtUp, ctx(at(25, 16, 59)))).toEqual({ fetch: false, reason: "up-to-date" })
  })

  it("überspringt ein Fenster direkt nach einem anderen Abruf", () => {
    expect(decideMeteoblue(fetchedAt(at(25, 11, 40)), ctx(at(25, 12, 5))).fetch).toBe(false)
  })

  it("ruft bei Ortswechsel über 5 km ab", () => {
    const fresh = fetchedAt(at(25, 12, 5))
    expect(decideMeteoblue(fresh, ctx(at(25, 13), { here: { lat: 49.02, lon: 8.4 } })).fetch).toBe(false)
    expect(decideMeteoblue(fresh, ctx(at(25, 13), { here: { lat: 49.1, lon: 8.4 } }))).toEqual({ fetch: true, reason: "moved" })
  })

  it("hält das 7-Tage-Budget ein", () => {
    const calls = Array.from({ length: METEOBLUE_PLAN.weeklyBudget }, (_, i) => at(25, 6) - (i + 1) * 6 * HOUR)
    const exhausted = state({ lastSuccess: at(24, 17), billedCalls: calls })
    expect(decideMeteoblue(exhausted, ctx(at(25, 7)))).toEqual({ fetch: false, reason: "budget" })
    expect(decideMeteoblue(exhausted, ctx(at(25, 7), { here: { lat: 50, lon: 8.4 } }))).toEqual({ fetch: false, reason: "budget" })
  })

  it("wartet nach einem Fehlversuch", () => {
    const failed = sourceFailure(fetchedAt(at(25, 6)), at(25, 12, 1))
    expect(decideMeteoblue(failed, ctx(at(25, 12, 10)))).toEqual({ fetch: false, reason: "retry-wait" })
    expect(decideMeteoblue(failed, ctx(at(25, 12, 30)))).toEqual({ fetch: true, reason: "slot" })
  })

  it("holt beim Antippen Daten, die älter als 3 Stunden sind", () => {
    const fresh = fetchedAt(at(25, 12, 5))
    expect(decideMeteoblue(fresh, ctx(at(25, 14), { trigger: "tap" }))).toEqual({ fetch: false, reason: "up-to-date" })
    expect(decideMeteoblue(fresh, ctx(at(25, 15, 10), { trigger: "tap" }))).toEqual({ fetch: true, reason: "tap" })
    // ohne Antippen wartet der normale Durchlauf bis 17 Uhr
    expect(decideMeteoblue(fresh, ctx(at(25, 15, 10)))).toEqual({ fetch: false, reason: "up-to-date" })
  })

  it("verbraucht beim Antippen kein Budget über die Grenze hinaus", () => {
    const calls = Array.from({ length: METEOBLUE_PLAN.weeklyBudget }, (_, i) => at(25, 6) - (i + 1) * 6 * HOUR)
    const exhausted = state({ lastSuccess: at(25, 6), billedCalls: calls })
    expect(decideMeteoblue(exhausted, ctx(at(25, 10), { trigger: "tap" }))).toEqual({ fetch: false, reason: "budget" })
  })

  it("lässt ein Zeitfenster aus, wenn kurz vorher per Antippen abgerufen wurde", () => {
    expect(decideMeteoblue(fetchedAt(at(25, 10, 30)), ctx(at(25, 12, 5))).fetch).toBe(false)
  })

  it("erlaubt Handabrufe bis zur Tagesgrenze", () => {
    const five = Array.from({ length: 5 }, (_, i) => at(25, 6 + i))
    expect(decideMeteoblue(fetchedAt(at(25, 10), five), ctx(at(25, 11), { trigger: "manual" }))).toEqual({ fetch: true, reason: "manual" })
    const six = [...five, at(25, 11)]
    expect(decideMeteoblue(fetchedAt(at(25, 11), six), ctx(at(25, 11, 30), { trigger: "manual" }))).toEqual({
      fetch: false,
      reason: "daily-max",
    })
  })

  it("passt ins Free-Kontingent von 10 Mio. Credits pro Jahr", () => {
    expect((METEOBLUE_PLAN.weeklyBudget / 7) * 365 * 8000).toBeLessThan(10_000_000)
  })
})

describe("meteoblueSuccess", () => {
  it("merkt sich Ort und Abruf und vergisst Abrufe älter als 8 Tage", () => {
    const next = meteoblueSuccess(state({ billedCalls: [at(10, 12), at(20, 12)] }), HOME, at(25, 13))
    expect(next).toEqual({ lastSuccess: at(25, 13), lastAttempt: at(25, 13), lastAttemptOk: true, location: HOME, billedCalls: [at(20, 12), at(25, 13)] })
  })
})

describe("decideSunsethue", () => {
  const base = { ...EMPTY_SOURCE, location: HOME }

  it("ruft nach jedem Sunsethue-Update ab", () => {
    // 10:30 UTC = 11:30 Berlin, plus 20 Minuten Puffer
    const s = { ...base, lastSuccess: at(25, 8) }
    expect(decideSunsethue(s, ctx(at(25, 11, 40)))).toBe(false)
    expect(decideSunsethue(s, ctx(at(25, 11, 55)))).toBe(true)
  })

  it("ruft ohne Daten, an einem neuen Tag und bei Ortswechsel ab", () => {
    expect(decideSunsethue({ ...base, lastSuccess: at(25, 12) }, ctx(at(25, 12, 5), { hasData: false }))).toBe(true)
    expect(decideSunsethue({ ...base, lastSuccess: at(24, 23, 50) }, ctx(at(25, 0, 10)))).toBe(true)
    expect(decideSunsethue({ ...base, lastSuccess: at(25, 12) }, ctx(at(25, 12, 30), { here: { lat: 49.2, lon: 8.4 } }))).toBe(true)
  })

  it("wartet 30 Minuten nach einem Fehler, außer von Hand", () => {
    const failed = sourceFailure(base, at(25, 12))
    expect(decideSunsethue(failed, ctx(at(25, 12, 20)))).toBe(false)
    expect(decideSunsethue(failed, ctx(at(25, 12, 20), { trigger: "manual" }))).toBe(true)
    expect(decideSunsethue(failed, ctx(at(25, 12, 31)))).toBe(true)
  })
})

describe("decideWarnings", () => {
  it("prüft alle 30 Minuten und bei jedem Antippen", () => {
    const s = { ...EMPTY_SOURCE, location: HOME, lastSuccess: at(25, 12) }
    expect(decideWarnings(s, ctx(at(25, 12, 29)))).toBe(false)
    expect(decideWarnings(s, ctx(at(25, 12, 29), { trigger: "tap" }))).toBe(true)
    expect(decideWarnings(s, ctx(at(25, 12, 30)))).toBe(true)
    expect(decideWarnings(EMPTY_SOURCE, ctx(at(25, 12)))).toBe(true)
  })
})
