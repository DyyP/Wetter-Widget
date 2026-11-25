/**
 * Sunsethue: Qualität von Sonnenauf- und -untergang.
 * Quelle: https://sunsethue.com/dev-api (Stand 11/2026). Endpunkt `/event`,
 * Key im Header `x-api-key`. Vorhersage für heute bis übermorgen, neu
 * berechnet alle 6 Stunden. Kostenlos 1.000 Credits pro Tag, etwa 5 pro Abruf.
 */

import { round, type Coordinates } from "./geo"

const SUNSETHUE_HOST = "https://api.sunsethue.com"
export const SUNSETHUE_KEY_HEADER = "x-api-key"

export type SunEventType = "sunrise" | "sunset"

export interface SunEventQuery extends Coordinates {
  /** Kalendertag am Ort, "YYYY-MM-DD" */
  date: string
  type: SunEventType
}

export interface SunEvent {
  type: SunEventType
  date: string
  /** UTC in ms */
  time: number | null
  /** 0–1, null ohne Modelldaten */
  quality: number | null
  qualityText: string | null
}

export function buildEventUrl(query: SunEventQuery): string {
  // Sunsethue rechnet auf einem groben Raster, 2 Nachkommastellen genügen
  return `${SUNSETHUE_HOST}/event?latitude=${round(query.lat, 2)}&longitude=${round(query.lon, 2)}&date=${query.date}&type=${query.type}`
}

/** Fehlerantwort: `{ status, code, message }`, z. B. code 204 „Exceeded daily quota“ */
export function errorFromSunsethue(status: number, body: unknown): Error {
  const message = isRecord(body) && typeof body["message"] === "string" ? body["message"] : `HTTP ${status}`
  return new Error(`Sunsethue: ${message}`)
}

export function parseEvent(body: unknown, query: Pick<SunEventQuery, "date" | "type">): SunEvent {
  if (!isRecord(body) || !isRecord(body["data"])) throw new Error("Sunsethue: Antwort ohne Feld data")
  const data = body["data"]
  if (data["type"] !== query.type) throw new Error(`Sunsethue: falscher Ereignistyp ${String(data["type"])}`)
  const time = typeof data["time"] === "string" ? Date.parse(data["time"]) : Number.NaN
  const quality = data["quality"]
  return {
    type: query.type,
    date: query.date,
    time: Number.isFinite(time) ? time : null,
    quality: typeof quality === "number" && Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : null,
    qualityText: typeof data["quality_text"] === "string" ? data["quality_text"] : null,
  }
}

export type QualityLevel = "high" | "medium" | "low"

/** Farbstufe wie im bisherigen Widget: ab 70 % orange, ab 40 % gelb, sonst grau */
export function qualityLevel(quality: number): QualityLevel {
  if (quality >= 0.7) return "high"
  if (quality >= 0.4) return "medium"
  return "low"
}

const KNOWN_TEXTS: Record<string, string> = {
  poor: "Schwach",
  fair: "Mäßig",
  good: "Gut",
  great: "Sehr gut",
  "very good": "Sehr gut",
  excellent: "Spitze",
}

/**
 * Deutsche Bewertung. Sunsethue dokumentiert die Texte nicht vollständig
 * (Beispiel der Doku: 0.45 = "Good"), deshalb bekannte Texte übersetzen,
 * sonst nach Zahlenwert einstufen.
 */
export function qualityLabel(quality: number, apiText: string | null): string {
  const translated = apiText === null ? undefined : KNOWN_TEXTS[apiText.trim().toLowerCase()]
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
