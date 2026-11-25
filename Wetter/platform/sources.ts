/** Abrufe der drei Datenquellen: meteoblue, Sunsethue und DWD (Bright Sky). */

import { buildAlertsUrl, parseAlerts, type Alert } from "../core/dwd"
import type { Coordinates } from "../core/geo"
import { buildBasicForecastUrl, errorFromResponse, parseBasicForecast, readCreditHeaders, type Forecast } from "../core/meteoblue"
import {
  SUNSETHUE_KEY_HEADER,
  buildEventUrl,
  errorFromSunsethue,
  parseEvent,
  type SunEvent,
  type SunEventQuery,
} from "../core/sunsethue"
import { getJson } from "./http"

export interface ForecastResult {
  forecast: Forecast
  /** Abgerechnete Credits laut Header */
  credits: number | null
}

export async function fetchForecast(apiKey: string, here: Coordinates): Promise<ForecastResult> {
  const result = await getJson(buildBasicForecastUrl(apiKey, here), { timeoutSeconds: 12, label: "meteoblue" })
  if (!result.ok) throw errorFromResponse(result.status, result.body)
  return { forecast: parseBasicForecast(result.body), credits: readCreditHeaders(result.headers).accounted }
}

/**
 * Holt mehrere Sonnenereignisse parallel. Einzelne Fehler sind erlaubt;
 * erst wenn alle scheitern, wird der erste Fehler weitergegeben.
 */
export async function fetchSunEvents(apiKey: string, queries: SunEventQuery[]): Promise<SunEvent[]> {
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const result = await getJson(buildEventUrl(query), {
        timeoutSeconds: 10,
        label: `sunsethue ${query.type} ${query.date}`,
        headers: { [SUNSETHUE_KEY_HEADER]: apiKey },
      })
      if (!result.ok) throw errorFromSunsethue(result.status, result.body)
      return parseEvent(result.body, query)
    }),
  )
  const events = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []))
  const firstError = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")
  if (events.length === 0 && firstError !== undefined) throw firstError.reason
  return events
}

export async function fetchAlerts(here: Coordinates): Promise<Alert[]> {
  const result = await getJson(buildAlertsUrl(here.lat, here.lon), { timeoutSeconds: 10, label: "DWD-Warnungen" })
  if (!result.ok) throw new Error(`Bright Sky: HTTP ${result.status}`)
  return parseAlerts(result.body)
}
