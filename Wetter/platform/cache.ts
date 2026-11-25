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

/** Alle Daten, aus denen das Widget gezeichnet wird; null, wenn noch nichts da ist */
export interface StoredData {
  forecast: Cached<Forecast> | null
  sunEvents: Cached<SunEvent[]> | null
  alerts: Cached<Alert[]> | null
}

export interface WidgetRun {
  /** UTC in ms */
  time: number
  /** Was gezeichnet wurde, z. B. "Wetter" oder der angezeigte Hinweis */
  result: string
  /** Fehler, der den Abruf ganz abgebrochen hat (Fehler einzelner Quellen stehen im Planer) */
  error: string | null
}

const file = (name: string) => `${sharedDirectory}/${name}.json`

export async function loadPlanner(): Promise<PlannerStore> {
  const stored = await readJson<Partial<PlannerStore>>(file("planner"))
  return {
    meteoblue: known(EMPTY_METEOBLUE, stored?.meteoblue),
    sunsethue: known(EMPTY_SOURCE, stored?.sunsethue),
    warnings: known(EMPTY_SOURCE, stored?.warnings),
    lastLocation: stored?.lastLocation ?? null,
  }
}
export const savePlanner = (store: PlannerStore) => writeJson(file("planner"), store)

export async function loadData(): Promise<StoredData> {
  const [forecast, sunEvents, alerts] = await Promise.all([
    readJson<Cached<Forecast>>(file("forecast")),
    readJson<Cached<SunEvent[]>>(file("sun-events")),
    readJson<Cached<Alert[]>>(file("alerts")),
  ])
  return { forecast, sunEvents, alerts }
}
export const saveForecast = (value: Cached<Forecast>) => writeJson(file("forecast"), value)
export const saveSunEvents = (value: Cached<SunEvent[]>) => writeJson(file("sun-events"), value)
export const saveAlerts = (value: Cached<Alert[]>) => writeJson(file("alerts"), value)

export const loadWidgetRun = () => readJson<WidgetRun>(file("widget-run"))
export const saveWidgetRun = (run: WidgetRun) => writeJson(file("widget-run"), run)

/** Übernimmt nur die Felder, die es heute gibt: Reste älterer Versionen fallen weg. */
function known<T extends object>(empty: T, stored: unknown): T {
  const result = { ...empty }
  if (typeof stored !== "object" || stored === null) return result
  for (const key of Object.keys(empty) as (keyof T)[]) {
    if (key in stored) result[key] = (stored as T)[key]
  }
  return result
}
