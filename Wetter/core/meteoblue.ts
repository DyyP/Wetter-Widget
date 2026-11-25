/**
 * meteoblue Forecast API: URL, Antwortprüfung und Umwandlung in das interne
 * Modell. Quelle: offizielle OpenAPI-Referenz https://my.meteoblue.com/packages/redoc
 * (Forecast API 2.0.0, Stand 11/2026).
 */

import { roundCoordinates, type Coordinates } from "./geo"

export const METEOBLUE_HOST = "https://my.meteoblue.com"

/** Stündliche und tägliche Werte des Basic-Pakets in einem Abruf */
export const BASIC_PACKAGES = ["basic-1h", "basic-day"] as const

/**
 * Credits pro Abruf. Bei mehreren Auflösungen desselben Pakets rechnet
 * meteoblue nur die teuerste ab: basic-1h + basic-day = 8000.
 * Auf dem iPhone über den Header `MB-Credits-Accounted` bestätigt.
 */
export const BASIC_CALL_CREDITS = 8000

export function buildBasicForecastUrl(apiKey: string, place: Coordinates): string {
  const key = apiKey.trim()
  if (key === "") throw new Error("meteoblue-API-Key fehlt")
  if (!isValidCoordinate(place)) throw new Error(`Ungültige Koordinaten: ${place.lat}, ${place.lon}`)
  const { lat, lon } = roundCoordinates(place)
  const params: [string, string][] = [
    ["apikey", key],
    ["lat", String(lat)],
    ["lon", String(lon)],
    ["format", "json"],
    // "2026-11-25 14:00" in Ortszeit; umgerechnet über metadata.utc_timeoffset,
    // das laut Referenz für die ganze Antwort gilt (keine Sommerzeitsprünge).
    ["timeformat", "Y-M-D"],
    ["temperatureUnit", "C"],
    ["precipitationUnit", "metric"],
  ]
  const search = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
  return `${METEOBLUE_HOST}/packages/${BASIC_PACKAGES.join(",")}?${search}`
}

/** Entfernt den API-Key aus einem Text, z. B. aus einer Fehlermeldung mit URL. */
export function redactApiKey(text: string): string {
  return text.replace(/([?&]apikey=)[^&\s]*/gi, "$1***")
}

export interface HourlyPoint {
  /** Beginn der Stunde, UTC in ms */
  time: number
  /** °C */
  temperature: number
  feltTemperature: number
  /** mm */
  precipitation: number
  /** 1–35 */
  pictocode: number
  isDaylight: boolean
}

export interface DailyPoint {
  /** Kalendertag am Ort, "YYYY-MM-DD" */
  date: string
  /** 1–17 */
  pictocode: number
  temperatureMax: number
  temperatureMin: number
  /** mm */
  precipitation: number
}

export interface Forecast {
  latitude: number
  longitude: number
  hourly: HourlyPoint[]
  daily: DailyPoint[]
}

export type MeteoblueErrorKind =
  /** Key ungültig, abgelaufen oder ohne Credits (HTTP 401/403) */
  | "access"
  /** Anfrage fehlerhaft (HTTP 400) */
  | "request"
  /** Zu viele Anfragen (HTTP 429) */
  | "rate-limit"
  /** Fehler bei meteoblue (HTTP 5xx) */
  | "server"
  /** Antwort hat nicht das erwartete Format */
  | "format"

export class MeteoblueError extends Error {
  readonly kind: MeteoblueErrorKind

  constructor(kind: MeteoblueErrorKind, message: string) {
    super(message)
    this.name = "MeteoblueError"
    this.kind = kind
  }
}

/** Fehlerantwort von meteoblue: `{ error: true, error_message }` */
export function errorFromResponse(status: number, body: unknown): MeteoblueError {
  const apiMessage = isRecord(body) && typeof body["error_message"] === "string" ? body["error_message"] : null
  const message = apiMessage ?? `HTTP ${status}`
  if (status === 401 || status === 403) return new MeteoblueError("access", message)
  if (status === 429) return new MeteoblueError("rate-limit", message)
  if (status >= 500) return new MeteoblueError("server", message)
  return new MeteoblueError("request", message)
}

/** Abgerechnete Credits laut Header `MB-Credits-Accounted`, falls vorhanden */
export function creditsAccounted(headers: Iterable<readonly [string, string]>): number | null {
  for (const [name, value] of headers) {
    if (name.toLowerCase() !== "mb-credits-accounted") continue
    const credits = Number.parseFloat(value)
    return Number.isFinite(credits) ? credits : null
  }
  return null
}

/** Prüft eine erfolgreiche Antwort. Wirft `MeteoblueError("format")` bei fehlenden Feldern. */
export function parseBasicForecast(body: unknown): Forecast {
  if (!isRecord(body)) throw formatError("Antwort ist kein Objekt")
  if (body["error"] === true) {
    throw new MeteoblueError("request", typeof body["error_message"] === "string" ? body["error_message"] : "unbekannter Fehler")
  }

  const metadata = record(body, "metadata")
  const utcOffsetHours = numberField(metadata, "utc_timeoffset", "metadata")

  const h = record(body, "data_1h")
  const hourTimes = array(h, "time", "data_1h")
  const hourly = columns(h, "data_1h", hourTimes.length, ["temperature", "felttemperature", "precipitation", "pictocode", "isdaylight"])
  const d = record(body, "data_day")
  const dayTimes = array(d, "time", "data_day")
  const daily = columns(d, "data_day", dayTimes.length, ["pictocode", "temperature_max", "temperature_min", "precipitation"])

  return {
    latitude: numberField(metadata, "latitude", "metadata"),
    longitude: numberField(metadata, "longitude", "metadata"),
    hourly: hourTimes.map((time, i) => {
      const v = hourly(i)
      return {
        time: toUtcMillis(time, utcOffsetHours),
        temperature: v.temperature,
        feltTemperature: v.felttemperature,
        precipitation: v.precipitation,
        pictocode: v.pictocode,
        isDaylight: v.isdaylight === 1,
      }
    }),
    daily: dayTimes.map((time, i) => {
      const v = daily(i)
      return {
        date: toDateString(time),
        pictocode: v.pictocode,
        temperatureMax: v.temperature_max,
        temperatureMin: v.temperature_min,
        precipitation: v.precipitation,
      }
    }),
  }
}

/** "2026-11-25 14:00" (Ortszeit) → UTC in ms */
export function toUtcMillis(value: unknown, utcOffsetHours: number): number {
  const match = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim()) : null
  if (!match) throw formatError(`Unbekanntes Zeitformat: ${JSON.stringify(value)}`)
  const [, y, mo, d, hh, mm] = match
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm)) - utcOffsetHours * 3_600_000
}

/** "2026-11-25" */
export function toDateString(value: unknown): string {
  const match = typeof value === "string" ? /^(\d{4}-\d{2}-\d{2})/.exec(value.trim()) : null
  if (!match?.[1]) throw formatError(`Unbekanntes Datumsformat: ${JSON.stringify(value)}`)
  return match[1]
}

function isValidCoordinate({ lat, lon }: Coordinates): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function formatError(message: string): MeteoblueError {
  return new MeteoblueError("format", message)
}

function record(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key]
  if (!isRecord(value)) throw formatError(`Feld "${key}" fehlt`)
  return value
}

function array(parent: Record<string, unknown>, key: string, section: string): unknown[] {
  const value = parent[key]
  if (!Array.isArray(value)) throw formatError(`Feld "${section}.${key}" fehlt`)
  return value
}

function numberField(parent: Record<string, unknown>, key: string, section: string): number {
  const value = parent[key]
  if (typeof value !== "number" || !Number.isFinite(value)) throw formatError(`Feld "${section}.${key}" fehlt oder ist keine Zahl`)
  return value
}

/** Prüft gleich lange Zahlenreihen und liefert pro Index ein Objekt mit allen Werten. */
function columns<K extends string>(
  parent: Record<string, unknown>,
  section: string,
  length: number,
  keys: readonly K[],
): (index: number) => Record<K, number> {
  const series = keys.map((key) => {
    const values = array(parent, key, section)
    if (values.length !== length) throw formatError(`Feld "${section}.${key}" hat ${values.length} statt ${length} Werte`)
    return values.map((value, i) => {
      if (typeof value !== "number" || !Number.isFinite(value)) throw formatError(`Feld "${section}.${key}[${i}]" ist keine Zahl`)
      return value
    })
  })
  return (index) => {
    const row = {} as Record<K, number>
    keys.forEach((key, k) => {
      row[key] = series[k]?.[index] ?? Number.NaN
    })
    return row
  }
}
