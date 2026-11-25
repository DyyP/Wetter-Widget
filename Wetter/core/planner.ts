/**
 * Entscheidet bei jedem Widget-Durchlauf, welche Quelle neu abgerufen wird.
 * Anzeigen kostet nichts, Abrufe kosten Credits: Das Widget rechnet die
 * aktuelle Stunde aus dem Cache und ruft meteoblue nur nach Plan ab.
 */

import { distanceKm, localDateString, type Coordinates } from "./geo"
import type { MeteoblueFailure } from "./meteoblue"

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

export interface SourceState {
  /** Letzter erfolgreicher Abruf, UTC in ms */
  lastSuccess: number | null
  /** Letzter Versuch, UTC in ms */
  lastAttempt: number | null
  /** Fehlermeldung des letzten Versuchs, null wenn er geklappt hat */
  lastError: string | null
  /** Für welchen Ort die gespeicherten Daten gelten */
  location: Coordinates | null
}

export interface MeteoblueState extends SourceState {
  /** Zeitpunkte abgerechneter Abrufe, für das Budget */
  billedCalls: number[]
  /** Art des letzten Fehlers, null wenn der letzte Versuch geklappt hat */
  lastFailure: MeteoblueFailure | null
}

export const EMPTY_SOURCE: SourceState = { lastSuccess: null, lastAttempt: null, lastError: null, location: null }
export const EMPTY_METEOBLUE: MeteoblueState = { ...EMPTY_SOURCE, billedCalls: [], lastFailure: null }

/**
 * Wer den Abruf auslöst:
 * - "schedule": normaler Widget-Durchlauf
 * - "tap": Antippen des Widgets, holt veraltete Daten im Rahmen des Budgets
 * - "manual": „Jetzt aktualisieren“ in der App, holt alles sofort
 */
export type Trigger = "schedule" | "tap" | "manual"

export interface Context {
  now: number
  /** Aktueller Ort, null wenn unbekannt */
  here: Coordinates | null
  /** Ob gespeicherte Daten dieser Quelle vorhanden sind */
  hasData: boolean
  trigger: Trigger
}

export const METEOBLUE_PLAN = {
  /** Abrufzeiten in Ortszeit (volle Stunden) */
  slotHours: [6, 12, 17],
  /** Höchstens 23 Abrufe in 7 Tagen ≈ 9,6 Mio. Credits pro Jahr (Free: 10 Mio.) */
  weeklyBudget: 23,
  /** Harte Obergrenze pro Kalendertag, auch für Handabrufe */
  dailyMax: 6,
  /** Ab dieser Entfernung zum Ort der Daten wird neu abgerufen */
  moveThresholdKm: 5,
  /** Wartezeit nach einem vorübergehenden Fehler (Netz, Server, zu viele Anfragen) */
  retryMinutes: 20,
  /** Ein planmäßiger Abruf entfällt, wenn der letzte so kurz zurückliegt */
  minGapMinutes: 120,
  /** Beim Antippen gelten Daten ab diesem Alter als veraltet */
  tapMaxAgeMinutes: 180,
} as const

/**
 * Fehler, die baldiges Wiederholen nicht behebt: Key abgelehnt, Anfrage
 * fehlerhaft, Antwort unbrauchbar. Neuer Versuch erst im nächsten Zeitfenster.
 */
const PERSISTENT_FAILURES: ReadonlySet<MeteoblueFailure> = new Set(["access", "request", "format"])

export type MeteoblueDecision =
  | { fetch: true; reason: "no-data" | "moved" | "slot" | "tap" | "manual" }
  | { fetch: false; reason: "up-to-date" | "budget" | "retry-wait" | "daily-max" }

export function decideMeteoblue(state: MeteoblueState, ctx: Context): MeteoblueDecision {
  const plan = METEOBLUE_PLAN
  const today = localDateString(ctx.now)
  if (state.billedCalls.filter((t) => localDateString(t) === today).length >= plan.dailyMax) {
    return { fetch: false, reason: "daily-max" }
  }
  if (ctx.trigger === "manual") return { fetch: true, reason: "manual" }
  if (meteoblueRetryWait(state, ctx.now)) return { fetch: false, reason: "retry-wait" }

  const budgetLeft = state.billedCalls.filter((t) => t > ctx.now - 7 * DAY && t <= ctx.now).length < plan.weeklyBudget
  const within = (reason: "no-data" | "moved" | "slot" | "tap"): MeteoblueDecision =>
    budgetLeft ? { fetch: true, reason } : { fetch: false, reason: "budget" }

  // Ohne Daten bliebe das Widget leer: sofort abrufen, solange Budget da ist.
  if (!ctx.hasData || state.lastSuccess === null) return within("no-data")
  if (movedFrom(state, ctx.here, plan.moveThresholdKm)) return within("moved")
  const due =
    state.lastSuccess < lastSlotStart(ctx.now, plan.slotHours) && state.lastSuccess < ctx.now - plan.minGapMinutes * MINUTE
  if (due) return within("slot")
  if (ctx.trigger === "tap" && state.lastSuccess < ctx.now - plan.tapMaxAgeMinutes * MINUTE) return within("tap")
  return { fetch: false, reason: "up-to-date" }
}

/** Neuer Zustand nach einem erfolgreichen meteoblue-Abruf (Abrufe älter als 8 Tage fallen weg). */
export function meteoblueSuccess(state: MeteoblueState, here: Coordinates, now: number): MeteoblueState {
  return { ...sourceSuccess(here, now), billedCalls: [...recentCalls(state, now), now], lastFailure: null }
}

/**
 * Neuer Zustand nach einem gescheiterten meteoblue-Abruf. Eine unbrauchbare
 * Antwort mit HTTP 200 („format“) hat meteoblue abgerechnet, sie zählt ins Budget.
 */
export function meteoblueFailure(state: MeteoblueState, now: number, failure: MeteoblueFailure, message: string): MeteoblueState {
  const billedCalls = failure === "format" ? [...recentCalls(state, now), now] : state.billedCalls
  return { ...sourceFailure(state, now, message), billedCalls, lastFailure: failure }
}

/** meteoblue lehnt den Key ab: ungültig, abgelaufen oder ohne Credits */
export function meteoblueKeyRejected(state: MeteoblueState): boolean {
  return state.lastFailure === "access"
}

/** Beginn des letzten Abruf-Zeitfensters vor `now` (Ortszeit des Geräts). */
export function lastSlotStart(now: number, slotHours: readonly number[]): number {
  const hours = [...slotHours].sort((a, b) => b - a)
  const base = new Date(now)
  for (const dayOffset of [0, 1]) {
    for (const hour of hours) {
      const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dayOffset, hour).getTime()
      if (start <= now) return start
    }
  }
  return now - DAY
}

/** Längste planmäßige Pause zwischen zwei Zeitfenstern in ms, bei 06/12/17 Uhr: 17 → 6 Uhr = 13 h */
export function longestSlotGap(slotHours: readonly number[]): number {
  const hours = [...slotHours].sort((a, b) => a - b)
  const gaps = hours.map((hour, i) => {
    // Nach dem letzten Fenster des Tages kommt das erste des nächsten Tages
    const next = hours[i + 1] ?? (hours[0] ?? hour) + 24
    return (next - hour) * HOUR
  })
  return Math.max(...gaps)
}

/**
 * Sunsethue rechnet laut Doku alle 6 Stunden neu (etwa 05:30, 10:30, 16:30
 * und 22:30 UTC). Abgerufen wird nach jedem Update, an einem neuen Tag und
 * bei Ortswechsel. Die Sunsethue-Credits reichen dafür reichlich.
 */
const SUNSETHUE_UPDATES_UTC: readonly (readonly [number, number])[] = [
  [5, 30],
  [10, 30],
  [16, 30],
  [22, 30],
]
/** Puffer, bis ein neues Sunsethue-Update sicher verfügbar ist */
const SUNSETHUE_DELAY_MINUTES = 20

export function decideSunsethue(state: SourceState, ctx: Context): boolean {
  if (ctx.trigger === "manual") return true
  if (inRetryWait(state, ctx.now, 30)) return false
  if (!ctx.hasData || state.lastSuccess === null) return true
  if (localDateString(state.lastSuccess) !== localDateString(ctx.now)) return true
  if (movedFrom(state, ctx.here, 10)) return true
  return state.lastSuccess < lastUtcUpdate(ctx.now - SUNSETHUE_DELAY_MINUTES * MINUTE)
}

/** DWD-Warnungen sind kostenlos: alle 30 Minuten, bei Ortswechsel und bei jedem Antippen. */
export function decideWarnings(state: SourceState, ctx: Context): boolean {
  if (ctx.trigger !== "schedule") return true
  if (inRetryWait(state, ctx.now, 10)) return false
  if (!ctx.hasData || state.lastSuccess === null) return true
  return movedFrom(state, ctx.here, 5) || ctx.now - state.lastSuccess >= 30 * MINUTE
}

export function sourceSuccess(here: Coordinates, now: number): SourceState {
  return { lastSuccess: now, lastAttempt: now, lastError: null, location: here }
}

export function sourceFailure<S extends SourceState>(state: S, now: number, message: string): S {
  return { ...state, lastAttempt: now, lastError: message }
}

/** Nach vorübergehenden Fehlern kurz warten, nach dauerhaften bis zum nächsten Zeitfenster */
function meteoblueRetryWait(state: MeteoblueState, now: number): boolean {
  if (state.lastError === null || state.lastAttempt === null) return false
  if (state.lastFailure !== null && PERSISTENT_FAILURES.has(state.lastFailure)) {
    return state.lastAttempt >= lastSlotStart(now, METEOBLUE_PLAN.slotHours)
  }
  return now - state.lastAttempt < METEOBLUE_PLAN.retryMinutes * MINUTE
}

function recentCalls(state: MeteoblueState, now: number): number[] {
  return state.billedCalls.filter((t) => t > now - 8 * DAY)
}

function lastUtcUpdate(time: number): number {
  const d = new Date(time)
  let latest = Number.NEGATIVE_INFINITY
  for (const dayOffset of [0, 1]) {
    for (const [h, m] of SUNSETHUE_UPDATES_UTC) {
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOffset, h, m)
      if (t <= time && t > latest) latest = t
    }
  }
  return latest
}

function movedFrom(state: SourceState, here: Coordinates | null, thresholdKm: number): boolean {
  return here !== null && state.location !== null && distanceKm(here, state.location) > thresholdKm
}

function inRetryWait(state: SourceState, now: number, minutes: number): boolean {
  return state.lastError !== null && state.lastAttempt !== null && now - state.lastAttempt < minutes * MINUTE
}
