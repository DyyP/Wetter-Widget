/**
 * Datenbeschaffung für Widget und App: Ort bestimmen, mit dem Planer
 * entscheiden, was abgerufen wird, abrufen und speichern. Die Quellen laufen
 * parallel; ein Fehler einer Quelle stoppt die anderen nicht, das Widget
 * zeigt dann deren letzten Stand.
 */

import { addDays, localDateString, type Coordinates } from "../core/geo"
import { redactApiKey } from "../core/meteoblue"
import {
  decideMeteoblue,
  decideSunsethue,
  decideWarnings,
  meteoblueSuccess,
  sourceFailure,
  sourceSuccess,
  type Context,
  type MeteoblueDecision,
} from "../core/planner"
import type { SunEventQuery } from "../core/sunsethue"
import { cachedSources, loadPlanner, saveAlerts, saveForecast, savePlanner, saveSunEvents } from "../platform/cache"
import { currentCoordinates, widgetLocationAllowed } from "../platform/location"
import { readSecret } from "../platform/secrets"
import { fetchAlerts, fetchForecast, fetchSunEvents } from "../platform/sources"

export type Outcome = "ok" | "skipped" | "failed" | "no-key"

export interface SourceReport {
  outcome: Outcome
  error: string | null
}

export interface RefreshReport {
  /** null: kein Ort bekannt, nichts abgerufen */
  location: Coordinates | null
  /** true: Ortung gescheitert, letzter bekannter Ort verwendet */
  locationFromCache: boolean
  meteoblue: SourceReport & { decision: MeteoblueDecision | null; credits: number | null }
  sunsethue: SourceReport
  warnings: SourceReport
}

/** Im Widget hat iOS nur wenige Sekunden Geduld, in der App darf es länger dauern. */
const LIMITS = {
  widget: { locationMs: 3000, fetchSeconds: 8 },
  app: { locationMs: 10_000, fetchSeconds: 20 },
} as const

export async function refresh(now: number, mode: { manual: boolean; inWidget: boolean }): Promise<RefreshReport> {
  const limits = mode.inWidget ? LIMITS.widget : LIMITS.app
  const [store, cached] = await Promise.all([loadPlanner(), cachedSources()])

  const located = mode.inWidget && !widgetLocationAllowed() ? null : await currentCoordinates(limits.locationMs)
  if (located !== null) store.lastLocation = located
  const here = located ?? store.lastLocation

  const report: RefreshReport = {
    location: here,
    locationFromCache: located === null && here !== null,
    meteoblue: { outcome: "skipped", error: null, decision: null, credits: null },
    sunsethue: { outcome: "skipped", error: null },
    warnings: { outcome: "skipped", error: null },
  }
  if (here === null) return report

  const context = (hasData: boolean): Context => ({ now, here, hasData, manual: mode.manual })
  const tasks: Promise<void>[] = []

  const meteoblueKey = readSecret("meteoblue")
  if (meteoblueKey === null) report.meteoblue.outcome = "no-key"
  else {
    const decision = decideMeteoblue(store.meteoblue, context(cached.forecast))
    report.meteoblue.decision = decision
    if (decision.fetch) {
      tasks.push(
        run(report.meteoblue, async () => {
          const { forecast, credits } = await fetchForecast(meteoblueKey, here, limits.fetchSeconds)
          await saveForecast({ fetchedAt: now, value: forecast })
          store.meteoblue = meteoblueSuccess(store.meteoblue, here, now)
          report.meteoblue.credits = credits
        }).catch(() => {
          store.meteoblue = sourceFailure(store.meteoblue, now)
        }),
      )
    }
  }

  const sunsethueKey = readSecret("sunsethue")
  if (sunsethueKey === null) report.sunsethue.outcome = "no-key"
  else if (decideSunsethue(store.sunsethue, context(cached.sunEvents))) {
    tasks.push(
      run(report.sunsethue, async () => {
        const events = await fetchSunEvents(sunsethueKey, sunQueries(here, now), limits.fetchSeconds)
        await saveSunEvents({ fetchedAt: now, value: events })
        store.sunsethue = sourceSuccess(here, now)
      }).catch(() => {
        store.sunsethue = sourceFailure(store.sunsethue, now)
      }),
    )
  }

  if (decideWarnings(store.warnings, context(cached.alerts))) {
    tasks.push(
      run(report.warnings, async () => {
        const alerts = await fetchAlerts(here, limits.fetchSeconds)
        await saveAlerts({ fetchedAt: now, value: alerts })
        store.warnings = sourceSuccess(here, now)
      }).catch(() => {
        store.warnings = sourceFailure(store.warnings, now)
      }),
    )
  }

  await Promise.all(tasks)
  await savePlanner(store)
  return report
}

/** Alle Fehlermeldungen eines Berichts, für Status und Widget-Protokoll */
export function reportErrors(report: RefreshReport): string[] {
  const entries: [string, SourceReport][] = [
    ["meteoblue", report.meteoblue],
    ["Sunsethue", report.sunsethue],
    ["DWD", report.warnings],
  ]
  return entries.flatMap(([name, source]) => (source.error === null ? [] : [`${name}: ${source.error}`]))
}

/** Heute und morgen Auf- und Untergang, übermorgen der Untergang für die Tagesreihe */
function sunQueries(here: Coordinates, now: number): SunEventQuery[] {
  const today = localDateString(now)
  const tomorrow = addDays(today, 1)
  return [
    { ...here, date: today, type: "sunrise" },
    { ...here, date: today, type: "sunset" },
    { ...here, date: tomorrow, type: "sunrise" },
    { ...here, date: tomorrow, type: "sunset" },
    { ...here, date: addDays(today, 2), type: "sunset" },
  ]
}

/** Führt einen Abruf aus und trägt das Ergebnis in den Bericht ein. Wirft bei Fehler weiter. */
async function run(report: SourceReport, task: () => Promise<void>): Promise<void> {
  try {
    await task()
    report.outcome = "ok"
  } catch (error) {
    report.outcome = "failed"
    report.error = redactApiKey(error instanceof Error ? error.message : String(error))
    throw error
  }
}
