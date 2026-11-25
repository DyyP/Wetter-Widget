/**
 * Sunsethue: Qualität von Sonnenauf- und -untergang.
 * Quelle: https://sunsethue.com/dev-api (Stand 11/2026). Endpunkt `/event`,
 * Key im Header `x-api-key`. Vorhersage für heute, morgen und übermorgen,
 * neu berechnet alle 6 Stunden. Kostenlos 1.000 Credits pro Tag, etwa 5 pro Abruf.
 */

export const SUNSETHUE_HOST = "https://api.sunsethue.com"
export const SUNSETHUE_KEY_HEADER = "x-api-key"
/** Wie viele Tage ab heute Sunsethue vorhersagt */
export const SUNSETHUE_HORIZON_DAYS = 3

export type SunEventType = "sunrise" | "sunset"

export interface SunEventQuery {
  lat: number
  lon: number
  /** Kalendertag am Ort, "YYYY-MM-DD" */
  date: string
  type: SunEventType
}

export function buildEventUrl(query: SunEventQuery): string {
  // Sunsethue rechnet auf einem groben Raster, 2 Nachkommastellen genügen
  const lat = Math.round(query.lat * 100) / 100
  const lon = Math.round(query.lon * 100) / 100
  return `${SUNSETHUE_HOST}/event?latitude=${lat}&longitude=${lon}&date=${query.date}&type=${query.type}`
}

export interface SunEvent {
  type: SunEventType
  date: string
  /** Zeitpunkt des Ereignisses, UTC in ms */
  time: number | null
  /** 0–1 */
  quality: number | null
  qualityText: string | null
  /** 0–1 */
  cloudCover: number | null
  /** Himmelsrichtung in Grad */
  direction: number | null
  goldenHour: [number, number] | null
  blueHour: [number, number] | null
  /** false, wenn Sunsethue für den Tag noch keine Modelldaten hat */
  modelData: boolean
}

export class SunsethueError extends Error {
  readonly quota: boolean
  readonly status: number | null

  constructor(message: string, status: number | null, quota = false) {
    super(message)
    this.name = "SunsethueError"
    this.status = status
    this.quota = quota
  }
}

/** Fehlerantwort: `{ status, code, message }`. Tageslimit: code 204 "Exceeded daily quota". */
export function errorFromSunsethue(status: number, body: unknown): SunsethueError {
  const record = isRecord(body) ? body : {}
  const message = typeof record["message"] === "string" ? record["message"] : `HTTP ${status}`
  const quota = record["code"] === 204 || /quota/i.test(message) || status === 429
  return new SunsethueError(message, status, quota)
}

export function parseEvent(body: unknown, query: Pick<SunEventQuery, "date" | "type">): SunEvent {
  if (!isRecord(body) || !isRecord(body["data"])) throw new SunsethueError("Antwort ohne Feld data", null)
  const data = body["data"]
  if (data["type"] !== query.type) throw new SunsethueError(`Falscher Ereignistyp: ${String(data["type"])}`, null)
  const magics = isRecord(data["magics"]) ? data["magics"] : {}
  return {
    type: query.type,
    date: query.date,
    time: parseTime(data["time"]),
    quality: unitInterval(data["quality"]),
    qualityText: typeof data["quality_text"] === "string" ? data["quality_text"] : null,
    cloudCover: unitInterval(data["cloud_cover"]),
    direction: typeof data["direction"] === "number" && Number.isFinite(data["direction"]) ? data["direction"] % 360 : null,
    goldenHour: window(magics["golden_hour"]),
    blueHour: window(magics["blue_hour"]),
    modelData: data["model_data"] === true,
  }
}

export type QualityLevel = "high" | "medium" | "low"

/**
 * Stufe für die Farbe, wie im bisherigen Widget:
 * ab 70 % orange, ab 40 % gelb, sonst grau.
 */
export function qualityLevel(quality: number): QualityLevel {
  if (quality >= 0.7) return "high"
  if (quality >= 0.4) return "medium"
  return "low"
}

/**
 * Deutsche Bewertung. Sunsethue dokumentiert die Texte nicht vollständig
 * (Beispiel: 0.45 = "Good"), deshalb zuerst bekannte Texte übersetzen,
 * sonst nach Zahlenwert einstufen.
 */
export function qualityLabel(quality: number, apiText: string | null = null): string {
  const known: Record<string, string> = {
    poor: "Schwach",
    fair: "Mäßig",
    good: "Gut",
    great: "Sehr gut",
    "very good": "Sehr gut",
    excellent: "Spitze",
  }
  const translated = apiText === null ? undefined : known[apiText.trim().toLowerCase()]
  if (translated !== undefined) return translated
  if (quality < 0.2) return "Schwach"
  if (quality < 0.4) return "Mäßig"
  if (quality < 0.6) return "Gut"
  if (quality < 0.8) return "Sehr gut"
  return "Spitze"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}

function unitInterval(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

function window(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length !== 2) return null
  const start = parseTime(value[0])
  const end = parseTime(value[1])
  return start !== null && end !== null && start <= end ? [start, end] : null
}
