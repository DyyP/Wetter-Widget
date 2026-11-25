/**
 * Entscheidet bei jedem Widget-Durchlauf, welche Quellen neu abgerufen werden.
 * Anzeigen kostet nichts, Abrufe kosten Credits: Das Widget rechnet die
 * aktuelle Stunde aus dem Cache und ruft meteoblue nur nach Plan ab.
 */

import { distanceKm, localDateString, type Coordinates } from "./geo"

export interface SourceState {
  /** Letzter erfolgreicher Abruf, UTC in ms */
  lastSuccess: number | null
  /** Letzter Versuch, UTC in ms */
  lastAttempt: number | null
  lastAttemptOk: boolean | null
  /** Für welchen Ort die gespeicherten Daten gelten */
  location: Coordinates | null
}

export interface MeteoblueState extends SourceState {
  /** Zeitpunkte abgerechneter Abrufe der letzten Tage, für das Budget */
  billedCalls: number[]
}

export const EMPTY_SOURCE: SourceState = { lastSuccess: null, lastAttempt: null, lastAttemptOk: null, location: null }
export const EMPTY_METEOBLUE: MeteoblueState = { ...EMPTY_SOURCE, billedCalls: [] }

export interface MeteobluePlan {
  /** Abrufzeiten in Ortszeit (volle Stunden) */
  slotHours: number[]
  /** Höchstzahl Abrufe in 7 Tagen. 23 ≈ 3,3 pro Tag = 9,6 Mio. Credits pro Jahr */
  weeklyBudget: number
  /** Harte Obergrenze pro Kalendertag, auch für Handabrufe */
  dailyMax: number
  /** Ab dieser Entfernung zum Ort der Daten wird neu abgerufen */
  moveThresholdKm: number
  /** Wartezeit nach einem fehlgeschlagenen Versuch */
  retryMinutes: number
  /** Ein planmäßiger Abruf entfällt, wenn der letzte so kurz zurückliegt */
  minGapMinutes: number
}

export const DEFAULT_METEOBLUE_PLAN: MeteobluePlan = {
  slotHours: [6, 12, 17],
  weeklyBudget: 23,
  dailyMax: 6,
  moveThresholdKm: 5,
  retryMinutes: 20,
  minGapMinutes: 60,
}

export type MeteoblueDecision =
  | { fetch: true; reason: "no-data" | "moved" | "slot" | "manual" }
  | { fetch: false; reason: "up-to-date" | "budget" | "retry-wait" | "daily-max" }

export function decideMeteoblue(
  state: MeteoblueState,
  here: Coordinates | null,
  now: number,
  plan: MeteobluePlan = DEFAULT_METEOBLUE_PLAN,
  manual = false,
): MeteoblueDecision {
  const weekCalls = state.billedCalls.filter((t) => t > now - 7 * 86_400_000 && t <= now).length
  const today = localDateString(now)
  const todayCalls = state.billedCalls.filter((t) => localDateString(t) === today).length
  if (todayCalls >= plan.dailyMax) return { fetch: false, reason: "daily-max" }
  if (manual) return { fetch: true, reason: "manual" }
  if (inRetryWait(state, now, plan.retryMinutes)) return { fetch: false, reason: "retry-wait" }

  // Ohne Daten wird immer abgerufen, sonst bliebe das Widget leer.
  if (state.lastSuccess === null) return { fetch: true, reason: "no-data" }

  const budgetLeft = weekCalls < plan.weeklyBudget
  const moved = here !== null && state.location !== null && distanceKm(here, state.location) > plan.moveThresholdKm
  if (moved) return budgetLeft ? { fetch: true, reason: "moved" } : { fetch: false, reason: "budget" }

  const slot = lastSlotStart(now, plan.slotHours)
  const due = state.lastSuccess < slot && state.lastSuccess < now - plan.minGapMinutes * 60_000
  if (due) return budgetLeft ? { fetch: true, reason: "slot" } : { fetch: false, reason: "budget" }

  return { fetch: false, reason: "up-to-date" }
}

/** Beginn des letzten Abruf-Zeitfensters (Ortszeit des Geräts) vor `now`. */
export function lastSlotStart(now: number, slotHours: number[]): number {
  const hours = [...slotHours].sort((a, b) => a - b)
  const base = new Date(now)
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (let i = hours.length - 1; i >= 0; i--) {
      const hour = hours[i] ?? 0
      const start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - dayOffset, hour).getTime()
      if (start <= now) return start
    }
  }
  return now - 86_400_000
}

/** Behält nur Abrufe der letzten 8 Tage im Zustand. */
export function pruneCalls(calls: number[], now: number): number[] {
  return calls.filter((t) => t > now - 8 * 86_400_000)
}

/**
 * Sunsethue rechnet laut Doku alle 6 Stunden neu (etwa 05:30, 10:30, 16:30
 * und 22:30 UTC). Abgerufen wird nach jedem dieser Updates, bei neuem
 * Kalendertag oder Ortswechsel. Credits reichen dafür reichlich.
 */
export const SUNSETHUE_UPDATES_UTC: [number, number][] = [
  [5, 30],
  [10, 30],
  [16, 30],
  [22, 30],
]

export function decideSunsethue(state: SourceState, here: Coordinates | null, now: number): boolean {
  if (inRetryWait(state, now, 30)) return false
  if (state.lastSuccess === null) return true
  if (localDateString(state.lastSuccess) !== localDateString(now)) return true
  if (here !== null && state.location !== null && distanceKm(here, state.location) > 10) return true
  // 20 Minuten Puffer, bis das neue Sunsethue-Update sicher verfügbar ist
  return state.lastSuccess < lastUtcUpdate(now - 20 * 60_000, SUNSETHUE_UPDATES_UTC)
}

function lastUtcUpdate(time: number, updates: [number, number][]): number {
  const d = new Date(time)
  let best = Number.NEGATIVE_INFINITY
  for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
    for (const [h, m] of updates) {
      const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dayOffset, h, m)
      if (t <= time && t > best) best = t
    }
  }
  return best
}

/** DWD-Warnungen: kostenlos, deshalb alle 30 Minuten und bei Ortswechsel. */
export function decideWarnings(state: SourceState, here: Coordinates | null, now: number): boolean {
  if (inRetryWait(state, now, 10)) return false
  if (state.lastSuccess === null) return true
  if (here !== null && state.location !== null && distanceKm(here, state.location) > 5) return true
  return now - state.lastSuccess >= 30 * 60_000
}

function inRetryWait(state: SourceState, now: number, minutes: number): boolean {
  return state.lastAttemptOk === false && state.lastAttempt !== null && now - state.lastAttempt < minutes * 60_000
}
