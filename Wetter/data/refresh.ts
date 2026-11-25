/**
 * Datenbeschaffung für Widget, Antippen und App: Ort bestimmen, mit dem Planer
 * entscheiden, was abgerufen wird, abrufen und speichern. Die Quellen laufen
 * parallel; ein Fehler einer Quelle stoppt die anderen nicht, das Widget
 * zeigt dann deren letzten Stand.
 */

import { addDays, localDateString, type Coordinates } from "../core/geo"
import { failureKind, redactApiKey } from "../core/meteoblue"
import {
  decideMeteoblue,
  decideSunsethue,
  decideWarnings,
  meteoblueFailure,
  meteoblueSuccess,
  sourceFailure,
  sourceSuccess,
  type Context,
  type MeteoblueDecision,
  type Trigger,
} from "../core/planner"
import type { SunEventQuery } from "../core/sunsethue"
import {
  loadData,
  loadPlanner,
  saveAlerts,
  saveForecast,
  savePlanner,
  saveSunEvents,
  type PlannerStore,
  type StoredData,
} from "../platform/cache"
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

export interface RefreshResult {
  report: RefreshReport
  /** Abrufzustand nach dem Durchlauf */
  planner: PlannerStore
  /** Daten nach dem Durchlauf, neu abgerufen oder aus dem Speicher */
  data: StoredData
}

/** Wo der Abruf läuft: im Widget, im Hintergrund nach Antippen (AppIntent) oder in der App */
export type Environment = "widget" | "intent" | "app"

/** Im Widget hat iOS nur wenige Sekunden Geduld, in der App darf es länger dauern. */
const LIMITS: Record<Environment, { locationMs: number; fetchSeconds: number }> = {
  widget: { locationMs: 3000, fetchSeconds: 8 },
  intent: { locationMs: 5000, fetchSeconds: 10 },
  app: { locationMs: 10_000, fetchSeconds: 20 },
}

export async function refresh(now: number, trigger: Trigger, environment: Environment): Promise<RefreshResult> {
  const limits = LIMITS[environment]
  const [store, data] = await Promise.all([loadPlanner(), loadData()])

  const mayLocate = environment !== "widget" || widgetLocationAllowed()
  const located = mayLocate ? await currentCoordinates(limits.locationMs) : null
  if (located !== null) store.lastLocation = located
  const here = located ?? store.lastLocation

  const report: RefreshReport = {
    location: here,
    locationFromCache: located === null && here !== null,
    meteoblue: { outcome: "skipped", error: null, decision: null, credits: null },
    sunsethue: { outcome: "skipped", error: null },
    warnings: { outcome: "skipped", error: null },
  }
  if (here === null) return { report, planner: store, data }

  const context = (hasData: boolean): Context => ({ now, here, hasData, trigger })
  const tasks: Promise<void>[] = []

  const meteoblueKey = readSecret("meteoblue")
  if (meteoblueKey === null) report.meteoblue.outcome = "no-key"
  else {
    const decision = decideMeteoblue(store.meteoblue, context(data.forecast !== null))
    report.meteoblue.decision = decision
    if (decision.fetch) {
      tasks.push(
        attempt(
          report.meteoblue,
          async () => {
            const { forecast, credits } = await fetchForecast(meteoblueKey, here, limits.fetchSeconds)
            // Erst den abgerechneten Abruf verbuchen, dann speichern
            store.meteoblue = meteoblueSuccess(store.meteoblue, here, now)
            report.meteoblue.credits = credits
            data.forecast = { fetchedAt: now, value: forecast }
            await saveForecast(data.forecast)
          },
          (error, message) => {
            store.meteoblue = meteoblueFailure(store.meteoblue, now, failureKind(error), message)
          },
        ),
      )
    }
  }

  const sunsethueKey = readSecret("sunsethue")
  if (sunsethueKey === null) report.sunsethue.outcome = "no-key"
  else if (decideSunsethue(store.sunsethue, context(data.sunEvents !== null))) {
    tasks.push(
      attempt(
        report.sunsethue,
        async () => {
          const events = await fetchSunEvents(sunsethueKey, sunQueries(here, now), limits.fetchSeconds)
          store.sunsethue = sourceSuccess(here, now)
          data.sunEvents = { fetchedAt: now, value: events }
          await saveSunEvents(data.sunEvents)
        },
        (_error, message) => {
          store.sunsethue = sourceFailure(store.sunsethue, now, message)
        },
      ),
    )
  }

  if (decideWarnings(store.warnings, context(data.alerts !== null))) {
    tasks.push(
      attempt(
        report.warnings,
        async () => {
          const alerts = await fetchAlerts(here, limits.fetchSeconds)
          store.warnings = sourceSuccess(here, now)
          data.alerts = { fetchedAt: now, value: alerts }
          await saveAlerts(data.alerts)
        },
        (_error, message) => {
          store.warnings = sourceFailure(store.warnings, now, message)
        },
      ),
    )
  }

  await Promise.all(tasks)
  await savePlanner(store)
  return { report, planner: store, data }
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

/** Führt einen Abruf aus, trägt das Ergebnis in den Bericht ein und meldet Fehler mit Meldung ohne API-Key. */
async function attempt(
  report: SourceReport,
  task: () => Promise<void>,
  onFailure: (error: unknown, message: string) => void,
): Promise<void> {
  try {
    await task()
    report.outcome = "ok"
  } catch (error) {
    const message = redactApiKey(error instanceof Error ? error.message : String(error))
    report.outcome = "failed"
    report.error = message
    onFailure(error, message)
  }
}
