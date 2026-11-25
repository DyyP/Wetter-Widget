/**
 * Offizielle meteoblue-Pictogramme. Die SVGs gehören meteoblue und werden zur
 * Laufzeit von static.meteoblue.com geladen, nie im Repo gespeichert.
 *
 * Dateinamen laut meteoblue-Website (geprüft 11/2026):
 * - stündlich, Codes 1–35: `07_day.svg`, `07_night.svg`
 * - täglich, Codes 1–17:   `07_iday.svg`
 */

export const PICTO_BASE_URL = "https://static.meteoblue.com/assets/images/picto"

/** Seitenverhältnis der meteoblue-SVGs (480 × 420). */
export const PICTO_ASPECT = 420 / 480

export function isHourlyPictocode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= 35
}

export function isDailyPictocode(code: number): boolean {
  return Number.isInteger(code) && code >= 1 && code <= 17
}

/** Dateiname des Stunden-Icons, z. B. "07_night.svg". */
export function hourlyIconName(code: number, isDay: boolean): string {
  if (!isHourlyPictocode(code)) throw new Error(`Ungültiger Stunden-Pictocode: ${code}`)
  return `${pad2(code)}_${isDay ? "day" : "night"}.svg`
}

/** Dateiname des Tages-Icons, z. B. "03_iday.svg". */
export function dailyIconName(code: number): string {
  if (!isDailyPictocode(code)) throw new Error(`Ungültiger Tages-Pictocode: ${code}`)
  return `${pad2(code)}_iday.svg`
}

export function iconUrl(name: string): string {
  return `${PICTO_BASE_URL}/${name}`
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
