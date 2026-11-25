/**
 * Gespeicherte Daten und Abrufzustand. Alles liegt im App-Group-Ordner,
 * damit App und Widget dieselben Daten sehen.
 */

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
  /** Letzter bekannter Standort, falls die Ortung im Widget scheitert */
  lastLocation: Coordinates | null
}

export interface Cached<T> {
  /** UTC in ms */
  fetchedAt: number
  value: T
}

const FILES = {
  planner: `${sharedDirectory}/planner.json`,
  forecast: `${sharedDirectory}/forecast.json`,
  sunEvents: `${sharedDirectory}/sun-events.json`,
  alerts: `${sharedDirectory}/alerts.json`,
} as const

export async function loadPlanner(): Promise<PlannerStore> {
  const stored = await readJson<Partial<PlannerStore>>(FILES.planner)
  return {
    meteoblue: { ...EMPTY_METEOBLUE, ...stored?.meteoblue },
    sunsethue: { ...EMPTY_SOURCE, ...stored?.sunsethue },
    warnings: { ...EMPTY_SOURCE, ...stored?.warnings },
    lastLocation: stored?.lastLocation ?? null,
  }
}

export const savePlanner = (store: PlannerStore) => writeJson(FILES.planner, store)

export const loadForecast = () => readJson<Cached<Forecast>>(FILES.forecast)
export const saveForecast = (value: Cached<Forecast>) => writeJson(FILES.forecast, value)

export const loadSunEvents = () => readJson<Cached<SunEvent[]>>(FILES.sunEvents)
export const saveSunEvents = (value: Cached<SunEvent[]>) => writeJson(FILES.sunEvents, value)

export const loadAlerts = () => readJson<Cached<Alert[]>>(FILES.alerts)
export const saveAlerts = (value: Cached<Alert[]>) => writeJson(FILES.alerts, value)
