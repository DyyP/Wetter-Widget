/** Gespeicherte Daten, Abrufzustand und Ergebnis des letzten Widget-Durchlaufs. */

import type { Alert } from "../core/dwd"
import type { Coordinates } from "../core/geo"
import type { Forecast } from "../core/meteoblue"
import { EMPTY_METEOBLUE, EMPTY_SOURCE, type MeteoblueState, type SourceState } from "../core/planner"
import type { SunEvent } from "../core/sunsethue"
import { readJson, sharedDirectory, writeJson } from "./storage"

export interface PlannerStore {
  meteoblue: MeteoblueState
  sunsethue: SourceState
  warnings: SourceState
  /** Letzter bekannter Ort, falls die Ortung scheitert */
  lastLocation: Coordinates | null
}

export interface Cached<T> {
  /** UTC in ms */
  fetchedAt: number
  value: T
}

export interface WidgetRun {
  /** UTC in ms */
  time: number
  /** Was gezeichnet wurde, z. B. "Wetter" oder der angezeigte Hinweis */
  result: string
  /** Fehler einer Datenquelle in diesem Durchlauf */
  errors: string[]
}

const file = (name: string) => `${sharedDirectory}/${name}.json`

export async function loadPlanner(): Promise<PlannerStore> {
  const stored = await readJson<Partial<PlannerStore>>(file("planner"))
  return {
    meteoblue: { ...EMPTY_METEOBLUE, ...stored?.meteoblue },
    sunsethue: { ...EMPTY_SOURCE, ...stored?.sunsethue },
    warnings: { ...EMPTY_SOURCE, ...stored?.warnings },
    lastLocation: stored?.lastLocation ?? null,
  }
}
export const savePlanner = (store: PlannerStore) => writeJson(file("planner"), store)

/** Welche Daten-Caches vorhanden sind (ohne sie zu lesen) */
export async function cachedSources(): Promise<{ forecast: boolean; sunEvents: boolean; alerts: boolean }> {
  const [forecast, sunEvents, alerts] = await Promise.all(
    ["forecast", "sun-events", "alerts"].map((name) => FileManager.exists(file(name))),
  )
  return { forecast: forecast === true, sunEvents: sunEvents === true, alerts: alerts === true }
}

export const loadForecast = () => readJson<Cached<Forecast>>(file("forecast"))
export const saveForecast = (value: Cached<Forecast>) => writeJson(file("forecast"), value)

export const loadSunEvents = () => readJson<Cached<SunEvent[]>>(file("sun-events"))
export const saveSunEvents = (value: Cached<SunEvent[]>) => writeJson(file("sun-events"), value)

export const loadAlerts = () => readJson<Cached<Alert[]>>(file("alerts"))
export const saveAlerts = (value: Cached<Alert[]>) => writeJson(file("alerts"), value)

export const loadWidgetRun = () => readJson<WidgetRun>(file("widget-run"))
export const saveWidgetRun = (run: WidgetRun) => writeJson(file("widget-run"), run)
