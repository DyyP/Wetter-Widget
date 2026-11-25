/**
 * Datenbeschaffung für Widget und App: Standort bestimmen, mit dem Planer
 * entscheiden, was abgerufen wird, abrufen und speichern. Fehler einer
 * Quelle stoppen die anderen nicht; das Widget zeigt dann den letzten Stand.
 */

import { addDays, localDateString, type Coordinates } from "../core/geo"
import { roundCoordinate } from "../core/meteoblue"
import {
  DEFAULT_METEOBLUE_PLAN,
  decideMeteoblue,
  decideSunsethue,
  decideWarnings,
  pruneCalls,
  type MeteoblueDecision,
  type SourceState,
} from "../core/planner"
import type { SunEventQuery } from "../core/sunsethue"
import { loadPlanner, saveAlerts, saveForecast, savePlanner, saveSunEvents } from "../platform/cache"
import { currentCoordinates } from "../platform/location"
import { readSecret } from "../platform/secrets"
import { fetchAlerts, fetchForecast, fetchSunEvents } from "../platform/sources"

export type SourceOutcome = "skipped" | "ok" | "failed" | "unavailable"

export interface RefreshReport {
  location: Coordinates | null
  /** true, wenn der Standort aus dem letzten bekannten Wert stammt */
  locationFromCache: boolean
  meteoblue: { decision: MeteoblueDecision | null; outcome: SourceOutcome; credits: number | null; error: string | null }
  sunsethue: { outcome: SourceOutcome; error: string | null }
  warnings: { outcome: SourceOutcome; error: string | null }
}

/** Standortabfrage im Widget darf nicht ewig dauern. */
const LOCATION_TIMEOUT_MS = 6000

export async function refresh(now: number, options: { manual?: boolean } = {}): Promise<RefreshReport> {
  const manual = options.manual ?? false
  const store = await loadPlanner()

  const fresh = await withTimeout(currentCoordinates(), LOCATION_TIMEOUT_MS)
  const here = fresh === null ? store.lastLocation : { lat: roundCoordinate(fresh.lat), lon: roundCoordinate(fresh.lon) }
  if (fresh !== null && here !== null) store.lastLocation = here

  const report: RefreshReport = {
    location: here,
    locationFromCache: fresh === null && here !== null,
    meteoblue: { decision: null, outcome: "skipped", credits: null, error: null },
    sunsethue: { outcome: "skipped", error: null },
    warnings: { outcome: "skipped", error: null },
  }
  if (here === null) {
    report.meteoblue.outcome = report.sunsethue.outcome = report.warnings.outcome = "unavailable"
    return report
  }

  const meteoblueKey = readSecret("meteoblue")
  const sunsethueKey = readSecret("sunsethue")
  const tasks: Promise<void>[] = []

  // meteoblue nach Plan (06/12/17 Uhr, Ortswechsel, Budget)
  if (meteoblueKey === null) report.meteoblue.outcome = "unavailable"
  else {
    const decision = decideMeteoblue(store.meteoblue, here, now, DEFAULT_METEOBLUE_PLAN, manual)
    report.meteoblue.decision = decision
    if (decision.fetch) {
      tasks.push(
        fetchForecast(meteoblueKey, here).then(
          async ({ forecast, credits }) => {
            await saveForecast({ fetchedAt: now, value: forecast })
            store.meteoblue = {
              lastSuccess: now,
              lastAttempt: now,
              lastAttemptOk: true,
              location: here,
              billedCalls: pruneCalls([...store.meteoblue.billedCalls, now], now),
            }
            report.meteoblue.outcome = "ok"
            report.meteoblue.credits = credits
          },
          (error: unknown) => {
            store.meteoblue = { ...store.meteoblue, lastAttempt: now, lastAttemptOk: false }
            report.meteoblue.outcome = "failed"
            report.meteoblue.error = message(error)
          },
        ),
      )
    }
  }

  // Sunsethue: heute und morgen Auf- und Untergang, übermorgen Untergang
  if (sunsethueKey === null) report.sunsethue.outcome = "unavailable"
  else if (manual || decideSunsethue(store.sunsethue, here, now)) {
    const today = localDateString(now)
    const queries: SunEventQuery[] = [
      { ...here, date: today, type: "sunrise" },
      { ...here, date: today, type: "sunset" },
      { ...here, date: addDays(today, 1), type: "sunrise" },
      { ...here, date: addDays(today, 1), type: "sunset" },
      { ...here, date: addDays(today, 2), type: "sunset" },
    ]
    tasks.push(
      fetchSunEvents(sunsethueKey, queries).then(
        async (events) => {
          await saveSunEvents({ fetchedAt: now, value: events })
          store.sunsethue = success(here, now)
          report.sunsethue.outcome = "ok"
        },
        (error: unknown) => {
          store.sunsethue = failure(store.sunsethue, now)
          report.sunsethue.outcome = "failed"
          report.sunsethue.error = message(error)
        },
      ),
    )
  }

  // DWD-Warnungen alle 30 Minuten
  if (manual || decideWarnings(store.warnings, here, now)) {
    tasks.push(
      fetchAlerts(here).then(
        async (alerts) => {
          await saveAlerts({ fetchedAt: now, value: alerts })
          store.warnings = success(here, now)
          report.warnings.outcome = "ok"
        },
        (error: unknown) => {
          store.warnings = failure(store.warnings, now)
          report.warnings.outcome = "failed"
          report.warnings.error = message(error)
        },
      ),
    )
  }

  await Promise.all(tasks)
  await savePlanner(store)
  return report
}

function success(location: Coordinates, now: number): SourceState {
  return { lastSuccess: now, lastAttempt: now, lastAttemptOk: true, location }
}

function failure(state: SourceState, now: number): SourceState {
  return { ...state, lastAttempt: now, lastAttemptOk: false }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: number | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
