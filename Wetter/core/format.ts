/**
 * Formatierung für die Anzeige. Bewusst ohne Intl, damit das Ergebnis auf dem
 * iPhone und in den Tests identisch ist.
 */

/** Tausenderpunkte nach deutscher Schreibweise: 8000 → "8.000" */
export function formatThousands(value: number): string {
  const sign = value < 0 ? "-" : ""
  const digits = String(Math.round(Math.abs(value)))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** Uhrzeit in der Zeitzone des Geräts: "07:05" */
export function formatClock(time: number): string {
  const date = new Date(time)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "heute 07:05", "gestern 23:10" oder "24.11. 07:05" relativ zu `now` */
export function formatRelativeDay(time: number, now: number): string {
  const day = startOfLocalDay(time)
  const today = startOfLocalDay(now)
  const clock = formatClock(time)
  if (day === today) return `heute ${clock}`
  if (today - day === 1) return `gestern ${clock}`
  const date = new Date(time)
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}. ${clock}`
}

/** Minuten als "45 min" oder "2 h 05 min" */
export function formatMinutes(minutes: number): string {
  const total = Math.round(minutes)
  if (total < 60) return `${total} min`
  return `${Math.floor(total / 60)} h ${pad2(total % 60)} min`
}

function startOfLocalDay(time: number): number {
  const date = new Date(time)
  // Tagesnummer statt Millisekunden, damit Sommerzeitwechsel nicht stören
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}
