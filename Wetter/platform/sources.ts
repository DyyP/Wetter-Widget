/** Abrufe der drei Datenquellen: meteoblue, Sunsethue und DWD (Bright Sky). */

import { alertsFromResponse, buildAlertsUrl, type Alert } from "../core/dwd"
import type { Coordinates } from "../core/geo"
import { buildBasicForecastUrl, creditsAccounted, errorFromResponse, parseBasicForecast, type Forecast } from "../core/meteoblue"
import { SUNSETHUE_KEY_HEADER, buildEventUrl, errorFromSunsethue, parseEvent, type SunEvent, type SunEventQuery } from "../core/sunsethue"
import { getJson } from "./http"

export async function fetchForecast(
  apiKey: string,
  here: Coordinates,
  timeoutSeconds: number,
): Promise<{ forecast: Forecast; credits: number | null }> {
  const response = await getJson(buildBasicForecastUrl(apiKey, here), { timeoutSeconds })
  if (!response.ok) throw errorFromResponse(response.status, response.body)
  return { forecast: parseBasicForecast(response.body), credits: creditsAccounted(response.headers) }
}

/** Mehrere Ereignisse parallel. Einzelne Fehler sind erlaubt, erst wenn alle scheitern, wirft es. */
export async function fetchSunEvents(apiKey: string, queries: SunEventQuery[], timeoutSeconds: number): Promise<SunEvent[]> {
  const settled = await Promise.allSettled(
    queries.map(async (query) => {
      const response = await getJson(buildEventUrl(query), { timeoutSeconds, headers: { [SUNSETHUE_KEY_HEADER]: apiKey } })
      if (!response.ok) throw errorFromSunsethue(response.status, response.body)
      return parseEvent(response.body, query)
    }),
  )
  const events = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []))
  const failure = settled.find((s): s is PromiseRejectedResult => s.status === "rejected")
  if (events.length === 0 && failure !== undefined) throw failure.reason
  return events
}

export async function fetchAlerts(here: Coordinates, timeoutSeconds: number): Promise<Alert[]> {
  const response = await getJson(buildAlertsUrl(here), { timeoutSeconds })
  return alertsFromResponse(response.status, response.body)
}
