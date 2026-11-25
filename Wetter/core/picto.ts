/**
 * Offizielle meteoblue-Pictogramme. Sie gehören meteoblue und werden zur
 * Laufzeit von static.meteoblue.com geladen, nie im Repo gespeichert.
 *
 * Dateinamen laut meteoblue-Website (geprüft 11/2026):
 * - stündlich, Codes 1–35: `07_day.svg`, `07_night.svg`
 * - täglich, Codes 1–17:   `07_iday.svg`
 */

import { pad2 } from "./format"

export const PICTO_BASE_URL = "https://static.meteoblue.com/assets/images/picto"

/** Seitenverhältnis Höhe/Breite der meteoblue-Grafiken (480 × 420) */
export const PICTO_ASPECT = 420 / 480

export const HOURLY_CODES = 35
export const DAILY_CODES = 17

export function isHourlyPictocode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= HOURLY_CODES
}

export function isDailyPictocode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= DAILY_CODES
}

/** "07_night.svg" */
export function hourlyIconName(code: number, isDay: boolean): string {
  if (!isHourlyPictocode(code)) throw new Error(`Ungültiger Stunden-Pictocode: ${code}`)
  return `${pad2(code)}_${isDay ? "day" : "night"}.svg`
}

/** "03_iday.svg" */
export function dailyIconName(code: number): string {
  if (!isDailyPictocode(code)) throw new Error(`Ungültiger Tages-Pictocode: ${code}`)
  return `${pad2(code)}_iday.svg`
}

/** Alle Icons, die das Widget brauchen kann (87 Stück) */
export function allIconNames(): string[] {
  const names: string[] = []
  for (let code = 1; code <= HOURLY_CODES; code++) names.push(hourlyIconName(code, true), hourlyIconName(code, false))
  for (let code = 1; code <= DAILY_CODES; code++) names.push(dailyIconName(code))
  return names
}

export function iconUrl(name: string): string {
  return `${PICTO_BASE_URL}/${name}`
}
