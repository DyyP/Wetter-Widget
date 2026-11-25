/**
 * Formatierung für die Anzeige. Bewusst ohne Intl, damit das Ergebnis auf dem
 * iPhone und in den Tests identisch ist. Zeiten gelten in der Zeitzone des Geräts.
 */

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

/** Tausenderpunkte nach deutscher Schreibweise: 8000 → "8.000" */
export function formatThousands(value: number): string {
  const sign = value < 0 ? "-" : ""
  const digits = String(Math.round(Math.abs(value)))
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/** "07:05" */
export function formatClock(time: number): string {
  const date = new Date(time)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "27.11." */
export function formatDayMonth(time: number): string {
  const date = new Date(time)
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.`
}

/** Fortlaufende Nummer des Kalendertags. Unabhängig von Sommerzeitwechseln. */
export function localDayNumber(time: number): number {
  const date = new Date(time)
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000)
}

/** "heute 07:05", "gestern 23:10" oder "24.11. 07:05" relativ zu `now` */
export function formatRelativeDay(time: number, now: number): string {
  const days = localDayNumber(now) - localDayNumber(time)
  const clock = formatClock(time)
  if (days === 0) return `heute ${clock}`
  if (days === 1) return `gestern ${clock}`
  return `${formatDayMonth(time)} ${clock}`
}

/** Zeigt von einem Schlüssel nur die letzten 4 Zeichen. */
export function maskSecret(value: string | null): string {
  if (value === null || value.trim() === "") return "fehlt"
  const trimmed = value.trim()
  return trimmed.length <= 4 ? "••••" : `••••${trimmed.slice(-4)}`
}
