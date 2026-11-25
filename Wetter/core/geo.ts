/** Koordinaten und Entfernungen. */

export interface Coordinates {
  lat: number
  lon: number
}

const EARTH_RADIUS_KM = 6371

/** Entfernung zweier Punkte in km (Haversine). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Kalendertag "YYYY-MM-DD" in der Zeitzone des Geräts. */
export function localDateString(time: number): string {
  const d = new Date(time)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Verschiebt einen Kalendertag "YYYY-MM-DD" um `days` Tage. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number)
  const shifted = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days))
  return shifted.toISOString().slice(0, 10)
}

/** Wochentag 0 = Sonntag eines Kalendertags "YYYY-MM-DD". */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}
