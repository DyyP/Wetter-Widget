import { describe, expect, it } from "vitest"
import {
  DEFAULT_METEOBLUE_PLAN,
  EMPTY_METEOBLUE,
  EMPTY_SOURCE,
  decideMeteoblue,
  decideSunsethue,
  decideWarnings,
  lastSlotStart,
  pruneCalls,
  type MeteoblueState,
} from "../Wetter/core/planner"

// Testzeitzone Europe/Berlin (siehe vitest.config.ts), November = UTC+1
const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()
const HOME = { lat: 49.0, lon: 8.4 }
const HOUR = 3_600_000

function state(partial: Partial<MeteoblueState>): MeteoblueState {
  return { ...EMPTY_METEOBLUE, location: HOME, ...partial }
}

describe("lastSlotStart", () => {
  it("findet das letzte Zeitfenster 06/12/17 Uhr", () => {
    expect(lastSlotStart(at(25, 9, 30), [6, 12, 17])).toBe(at(25, 6))
    expect(lastSlotStart(at(25, 12, 0), [6, 12, 17])).toBe(at(25, 12))
    expect(lastSlotStart(at(25, 23, 0), [6, 12, 17])).toBe(at(25, 17))
    expect(lastSlotStart(at(25, 5, 59), [6, 12, 17])).toBe(at(24, 17))
  })
})

describe("decideMeteoblue", () => {
  it("ruft ohne Daten sofort ab", () => {
    expect(decideMeteoblue(EMPTY_METEOBLUE, HOME, at(25, 3))).toEqual({ fetch: true, reason: "no-data" })
  })

  it("ruft einmal pro Zeitfenster ab", () => {
    const fresh = state({ lastSuccess: at(25, 6, 5), billedCalls: [at(25, 6, 5)] })
    expect(decideMeteoblue(fresh, HOME, at(25, 11, 50))).toEqual({ fetch: false, reason: "up-to-date" })
    expect(decideMeteoblue(fresh, HOME, at(25, 12, 1))).toEqual({ fetch: true, reason: "slot" })
  })

  it("holt ein verpasstes Fenster nach, aber nur einmal", () => {
    const old = state({ lastSuccess: at(24, 17, 10), billedCalls: [at(24, 17, 10)] })
    expect(decideMeteoblue(old, HOME, at(25, 14))).toEqual({ fetch: true, reason: "slot" })
    const caughtUp = state({ lastSuccess: at(25, 14), billedCalls: [at(24, 17, 10), at(25, 14)] })
    expect(decideMeteoblue(caughtUp, HOME, at(25, 16, 59))).toEqual({ fetch: false, reason: "up-to-date" })
  })

  it("überspringt ein Fenster direkt nach einem anderen Abruf", () => {
    const justFetched = state({ lastSuccess: at(25, 11, 40), billedCalls: [at(25, 11, 40)] })
    expect(decideMeteoblue(justFetched, HOME, at(25, 12, 5)).fetch).toBe(false)
  })

  it("ruft bei Ortswechsel über 5 km ab", () => {
    const fresh = state({ lastSuccess: at(25, 12, 5), billedCalls: [at(25, 12, 5)] })
    expect(decideMeteoblue(fresh, { lat: 49.02, lon: 8.4 }, at(25, 13)).fetch).toBe(false)
    expect(decideMeteoblue(fresh, { lat: 49.1, lon: 8.4 }, at(25, 13))).toEqual({ fetch: true, reason: "moved" })
  })

  it("hält das 7-Tage-Budget ein", () => {
    const calls = Array.from({ length: DEFAULT_METEOBLUE_PLAN.weeklyBudget }, (_, i) => at(25, 6) - (i + 1) * 6 * HOUR)
    const exhausted = state({ lastSuccess: at(24, 17), billedCalls: calls })
    expect(decideMeteoblue(exhausted, HOME, at(25, 7))).toEqual({ fetch: false, reason: "budget" })
    expect(decideMeteoblue(exhausted, { lat: 50, lon: 8.4 }, at(25, 7))).toEqual({ fetch: false, reason: "budget" })
  })

  it("wartet nach einem Fehlversuch", () => {
    const failed = state({ lastSuccess: at(25, 6), lastAttempt: at(25, 12, 1), lastAttemptOk: false, billedCalls: [at(25, 6)] })
    expect(decideMeteoblue(failed, HOME, at(25, 12, 10))).toEqual({ fetch: false, reason: "retry-wait" })
    expect(decideMeteoblue(failed, HOME, at(25, 12, 30))).toEqual({ fetch: true, reason: "slot" })
  })

  it("erlaubt Handabrufe bis zur Tagesgrenze", () => {
    const today = Array.from({ length: 5 }, (_, i) => at(25, 6 + i))
    expect(decideMeteoblue(state({ lastSuccess: at(25, 10), billedCalls: today }), HOME, at(25, 11), undefined, true)).toEqual({
      fetch: true,
      reason: "manual",
    })
    const full = [...today, at(25, 11)]
    expect(decideMeteoblue(state({ lastSuccess: at(25, 11), billedCalls: full }), HOME, at(25, 11, 30), undefined, true)).toEqual({
      fetch: false,
      reason: "daily-max",
    })
  })

  it("das Budget passt ins Free-Kontingent von 10 Mio. Credits", () => {
    const creditsPerYear = (DEFAULT_METEOBLUE_PLAN.weeklyBudget / 7) * 365 * 8000
    expect(creditsPerYear).toBeLessThan(10_000_000)
  })
})

describe("pruneCalls", () => {
  it("behält nur die letzten 8 Tage", () => {
    expect(pruneCalls([at(10, 12), at(20, 12), at(25, 12)], at(25, 13))).toEqual([at(20, 12), at(25, 12)])
  })
})

describe("decideSunsethue", () => {
  const base = { ...EMPTY_SOURCE, location: HOME }

  it("ruft nach jedem Sunsethue-Update ab", () => {
    // 10:30 UTC = 11:30 Berlin, plus 20 Minuten Puffer
    const s = { ...base, lastSuccess: at(25, 8) }
    expect(decideSunsethue(s, HOME, at(25, 11, 40))).toBe(false)
    expect(decideSunsethue(s, HOME, at(25, 11, 55))).toBe(true)
  })

  it("ruft an einem neuen Tag und bei Ortswechsel ab", () => {
    expect(decideSunsethue({ ...base, lastSuccess: at(24, 23, 50) }, HOME, at(25, 0, 10))).toBe(true)
    expect(decideSunsethue({ ...base, lastSuccess: at(25, 12) }, { lat: 49.2, lon: 8.4 }, at(25, 12, 30))).toBe(true)
  })

  it("wartet 30 Minuten nach einem Fehler", () => {
    const failed = { ...base, lastSuccess: null, lastAttempt: at(25, 12), lastAttemptOk: false }
    expect(decideSunsethue(failed, HOME, at(25, 12, 20))).toBe(false)
    expect(decideSunsethue(failed, HOME, at(25, 12, 31))).toBe(true)
  })
})

describe("decideWarnings", () => {
  it("prüft alle 30 Minuten", () => {
    const s = { ...EMPTY_SOURCE, location: HOME, lastSuccess: at(25, 12) }
    expect(decideWarnings(s, HOME, at(25, 12, 29))).toBe(false)
    expect(decideWarnings(s, HOME, at(25, 12, 30))).toBe(true)
    expect(decideWarnings({ ...EMPTY_SOURCE }, HOME, at(25, 12))).toBe(true)
  })
})
