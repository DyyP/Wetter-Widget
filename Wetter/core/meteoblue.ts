/**
 * meteoblue Forecast API: URL-Bau, Antwort-Prüfung und Umwandlung in das
 * interne Datenmodell.
 *
 * Reine Logik ohne Scripting-APIs, damit alles in Node getestet werden kann.
 * Quelle der Fakten: offizielle OpenAPI-Referenz
 * https://my.meteoblue.com/packages/redoc (Forecast API 2.0.0, Stand 11/2026).
 */

export const METEOBLUE_HOST = "https://my.meteoblue.com"

/** Stündliche und tägliche Werte des Basic-Pakets in einem Abruf. */
export const BASIC_PACKAGES = ["basic-1h", "basic-day"] as const

/**
 * Credits pro Abruf. Laut Referenz wird bei mehreren Auflösungen desselben
 * Pakets nur die teuerste berechnet: basic-1h + basic-day = 8000, nicht 12000.
 */
export const BASIC_CALL_CREDITS = 8000

/** Kostenloses Kontingent der Free Weather API pro Jahr. */
export const FREE_CREDITS_PER_YEAR = 10_000_000

export interface ForecastQuery {
  /** Breitengrad in Grad (WGS 84) */
  lat: number
  /** Längengrad in Grad (WGS 84) */
  lon: number
  /** Höhe über Meer in Metern. Ohne Angabe nutzt meteoblue ein 80-m-Höhenmodell. */
  asl?: number
  /** Anzahl Vorhersagetage. Ohne Angabe liefert die API so viele wie möglich. */
  forecastDays?: number
}

/**
 * Rundet Koordinaten. 3 Nachkommastellen entsprechen etwa 100 m: genau genug
 * für eine Punktvorhersage und gibt nicht den exakten Aufenthaltsort preis.
 */
export function roundCoordinate(value: number, decimals = 3): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Baut die Abruf-URL für basic-1h und basic-day. */
export function buildBasicForecastUrl(apiKey: string, query: ForecastQuery): string {
  const key = apiKey.trim()
  if (key === "") throw new Error("meteoblue-API-Key fehlt")
  if (!isValidLatitude(query.lat) || !isValidLongitude(query.lon)) {
    throw new Error(`Ungültige Koordinaten: ${query.lat}, ${query.lon}`)
  }

  const params: [string, string][] = [
    ["apikey", key],
    ["lat", String(roundCoordinate(query.lat))],
    ["lon", String(roundCoordinate(query.lon))],
    ["format", "json"],
    // Standardformat "2026-11-25 14:00" in Ortszeit. Umgerechnet wird über
    // metadata.utc_timeoffset, das laut Referenz für die ganze Antwort gilt.
    ["timeformat", "Y-M-D"],
    ["temperatureUnit", "C"],
    ["windSpeedUnit", "km/h"],
    ["precipitationUnit", "metric"],
  ]
  if (query.asl !== undefined) params.push(["asl", String(Math.round(query.asl))])
  if (query.forecastDays !== undefined) params.push(["forecastDays", String(query.forecastDays)])

  const search = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&")
  return `${METEOBLUE_HOST}/packages/${BASIC_PACKAGES.join(",")}?${search}`
}

/** Ersetzt den API-Key in einer URL, damit sie gefahrlos protokolliert werden kann. */
export function redactApiKey(url: string): string {
  return url.replace(/([?&]apikey=)[^&]*/i, "$1***")
}

// ---------------------------------------------------------------------------
// Datenmodell
// ---------------------------------------------------------------------------

export interface HourlyPoint {
  /** Beginn der Stunde als UTC-Zeitstempel in Millisekunden */
  time: number
  /** °C */
  temperature: number
  /** Gefühlte Temperatur in °C */
  feltTemperature: number
  /** Niederschlag in mm */
  precipitation: number
  /** Niederschlagswahrscheinlichkeit in % */
  precipitationProbability: number | null
  /** meteoblue-Pictocode 1–35 */
  pictocode: number
  isDaylight: boolean
}

export interface DailyPoint {
  /** Kalendertag am Ort, "YYYY-MM-DD" */
  date: string
  /** meteoblue-Tages-Pictocode 1–17 */
  pictocode: number
  temperatureMax: number
  temperatureMin: number
  /** Niederschlag in mm */
  precipitation: number
  precipitationProbability: number | null
  /** Vorhersagbarkeit in % */
  predictability: number | null
  /** 1 = sehr niedrig … 5 = sehr hoch */
  predictabilityClass: number | null
}

export interface Forecast {
  latitude: number
  longitude: number
  /** Höhe des Vorhersagepunkts in m */
  heightM: number | null
  /** Zeitversatz der Ortszeit zu UTC in Stunden, gültig für die ganze Antwort */
  utcOffsetHours: number
  timezoneAbbreviation: string | null
  /** Startzeit des verwendeten Modelllaufs (UTC), wie von der API geliefert */
  modelRunUtc: string | null
  /** Zeitpunkt, zu dem der Modelllauf fertig verarbeitet war (UTC) */
  modelRunUpdateUtc: string | null
  hourly: HourlyPoint[]
  daily: DailyPoint[]
}

// ---------------------------------------------------------------------------
// Fehler
// ---------------------------------------------------------------------------

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
  readonly status: number | null

  constructor(kind: MeteoblueErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = "MeteoblueError"
    this.kind = kind
    this.status = status
  }
}

/** Ordnet eine Fehlerantwort ein. meteoblue liefert `{ error: true, error_message }`. */
export function errorFromResponse(status: number, body: unknown): MeteoblueError {
  const apiMessage = isRecord(body) && typeof body["error_message"] === "string" ? body["error_message"] : null
  const message = apiMessage ?? `HTTP ${status}`
  if (status === 401 || status === 403) return new MeteoblueError("access", message, status)
  if (status === 429) return new MeteoblueError("rate-limit", message, status)
  if (status >= 500) return new MeteoblueError("server", message, status)
  return new MeteoblueError("request", message, status)
}

// ---------------------------------------------------------------------------
// Credits
// ---------------------------------------------------------------------------

export interface CreditHeaders {
  /** Abgerechnete Credits dieses Abrufs, falls die API sie meldet */
  accounted: number | null
  /** Alle Header, deren Name "credit" enthält, für die Diagnose */
  all: Record<string, string>
}

/**
 * Liest Credit-Angaben aus den Antwort-Headern. Community-Projekte nennen
 * `MB-Credits-Accounted`; offiziell dokumentiert ist der Header nicht, deshalb
 * werden alle Header mit "credit" im Namen gesammelt.
 */
export function readCreditHeaders(entries: Iterable<readonly [string, string]>): CreditHeaders {
  const all: Record<string, string> = {}
  for (const [name, value] of entries) {
    if (/credit/i.test(name)) all[name.toLowerCase()] = value
  }
  const preferred = all["mb-credits-accounted"]
  const fallback = Object.values(all).find((value) => Number.isFinite(Number.parseFloat(value)))
  const raw = preferred ?? fallback
  const accounted = raw === undefined ? null : Number.parseFloat(raw)
  return { all, accounted: accounted !== null && Number.isFinite(accounted) ? accounted : null }
}

// ---------------------------------------------------------------------------
// Antwort parsen
// ---------------------------------------------------------------------------

/**
 * Prüft eine erfolgreiche API-Antwort und wandelt sie in das interne Modell um.
 * Wirft `MeteoblueError("format")`, wenn Pflichtfelder fehlen oder nicht passen.
 */
export function parseBasicForecast(body: unknown): Forecast {
  if (!isRecord(body)) throw formatError("Antwort ist kein Objekt")
  if (body["error"] === true) {
    const message = typeof body["error_message"] === "string" ? body["error_message"] : "unbekannter Fehler"
    throw new MeteoblueError("request", message)
  }

  const metadata = record(body, "metadata")
  const utcOffsetHours = numberField(metadata, "utc_timeoffset", "metadata")

  const h = record(body, "data_1h")
  const hourTimes = array(h, "time", "data_1h")
  const hourCount = hourTimes.length
  const temperature = numberArray(h, "temperature", hourCount, "data_1h")
  const felt = numberArray(h, "felttemperature", hourCount, "data_1h")
  const precipitation = numberArray(h, "precipitation", hourCount, "data_1h")
  const pictocode = numberArray(h, "pictocode", hourCount, "data_1h")
  const isDaylight = numberArray(h, "isdaylight", hourCount, "data_1h")
  const precipitationProbability = optionalNumberArray(h, "precipitation_probability", hourCount)

  const hourly: HourlyPoint[] = hourTimes.map((time, i) => ({
    time: toUtcMillis(time, utcOffsetHours),
    temperature: at(temperature, i),
    feltTemperature: at(felt, i),
    precipitation: at(precipitation, i),
    precipitationProbability: precipitationProbability?.[i] ?? null,
    pictocode: at(pictocode, i),
    isDaylight: at(isDaylight, i) === 1,
  }))

  const d = record(body, "data_day")
  const dayTimes = array(d, "time", "data_day")
  const dayCount = dayTimes.length
  const dayPictocode = numberArray(d, "pictocode", dayCount, "data_day")
  const tMax = numberArray(d, "temperature_max", dayCount, "data_day")
  const tMin = numberArray(d, "temperature_min", dayCount, "data_day")
  const dayPrecipitation = numberArray(d, "precipitation", dayCount, "data_day")
  const dayPrecipitationProbability = optionalNumberArray(d, "precipitation_probability", dayCount)
  const predictability = optionalNumberArray(d, "predictability", dayCount)
  const predictabilityClass = optionalNumberArray(d, "predictability_class", dayCount)

  const daily: DailyPoint[] = dayTimes.map((time, i) => ({
    date: toDateString(time),
    pictocode: at(dayPictocode, i),
    temperatureMax: at(tMax, i),
    temperatureMin: at(tMin, i),
    precipitation: at(dayPrecipitation, i),
    precipitationProbability: dayPrecipitationProbability?.[i] ?? null,
    predictability: predictability?.[i] ?? null,
    predictabilityClass: predictabilityClass?.[i] ?? null,
  }))

  return {
    latitude: numberField(metadata, "latitude", "metadata"),
    longitude: numberField(metadata, "longitude", "metadata"),
    heightM: optionalNumber(metadata["height"]),
    utcOffsetHours,
    timezoneAbbreviation: optionalString(metadata["timezone_abbrevation"]),
    modelRunUtc: optionalString(metadata["modelrun_utc"]),
    modelRunUpdateUtc: optionalString(metadata["modelrun_updatetime_utc"]),
    hourly,
    daily,
  }
}

/**
 * Wandelt eine Zeitangabe der API in einen UTC-Zeitstempel (ms) um.
 * Unterstützt "YYYY-MM-DD HH:MM" (Ortszeit, Standardformat) sowie Zahlen als
 * Sekunden seit 1970 (Format timestamp_utc), falls die API so antwortet.
 */
export function toUtcMillis(value: unknown, utcOffsetHours: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    // Sekunden oder bereits Millisekunden
    return value > 1e12 ? value : value * 1000
  }
  if (typeof value === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/.exec(value.trim())
    if (match) {
      const [, y, mo, d, hh, mm] = match
      const localAsUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(hh), Number(mm))
      return localAsUtc - utcOffsetHours * 3_600_000
    }
  }
  throw formatError(`Unbekanntes Zeitformat: ${JSON.stringify(value)}`)
}

/** Liefert den Kalendertag "YYYY-MM-DD" aus der Tageszeitachse. */
export function toDateString(value: unknown): string {
  if (typeof value === "string") {
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
    if (match?.[1]) return match[1]
  }
  throw formatError(`Unbekanntes Datumsformat: ${JSON.stringify(value)}`)
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90
}

function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180
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

function numberArray(parent: Record<string, unknown>, key: string, length: number, section: string): number[] {
  const values = array(parent, key, section)
  if (values.length !== length) {
    throw formatError(`Feld "${section}.${key}" hat ${values.length} statt ${length} Werte`)
  }
  return values.map((value, i) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw formatError(`Feld "${section}.${key}[${i}]" ist keine Zahl`)
    }
    return value
  })
}

/** Optionale Reihe: fehlt sie oder hat sie eine andere Länge, wird sie ignoriert. */
function optionalNumberArray(parent: Record<string, unknown>, key: string, length: number): (number | null)[] | null {
  const values = parent[key]
  if (!Array.isArray(values) || values.length !== length) return null
  return values.map(optionalNumber)
}

function numberField(parent: Record<string, unknown>, key: string, section: string): number {
  const value = parent[key]
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw formatError(`Feld "${section}.${key}" fehlt oder ist keine Zahl`)
  }
  return value
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null
}

function at(values: number[], index: number): number {
  const value = values[index]
  if (value === undefined) throw formatError(`Index ${index} fehlt`)
  return value
}
