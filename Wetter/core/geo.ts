/** Koordinaten, Entfernungen und Kalendertage. */

import { pad2 } from "./format"

export interface Coordinates {
  lat: number
  lon: number
}

/**
 * Rundet auf 3 Nachkommastellen (etwa 100 m): genau genug für eine
 * Punktvorhersage und verrät nicht den exakten Aufenthaltsort.
 */
export function roundCoordinates(place: Coordinates): Coordinates {
  return { lat: round(place.lat, 3), lon: round(place.lon, 3) }
}

export function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Entfernung zweier Punkte in km (Haversine). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Kalendertag "YYYY-MM-DD" in der Zeitzone des Geräts. */
export function localDateString(time: number): string {
  const d = new Date(time)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** Verschiebt einen Kalendertag "YYYY-MM-DD" um `days` Tage. */
export function addDays(date: string, days: number): string {
  return calendarDate(date, days).toISOString().slice(0, 10)
}

/** Wochentag eines Kalendertags, 0 = Sonntag. */
export function weekday(date: string): number {
  return calendarDate(date, 0).getUTCDay()
}

function calendarDate(date: string, offsetDays: number): Date {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + offsetDays))
}
