/**
 * Amtliche Warnungen des Deutschen Wetterdienstes über Bright Sky
 * (https://brightsky.dev, kostenlos, ohne Key). Endpunkt `/alerts?lat=&lon=`
 * liefert die Warnungen der Gemeinde am Standort. Es gelten die
 * Nutzungsbedingungen des DWD.
 */

import { formatClock } from "./format"

export const BRIGHTSKY_ALERTS_URL = "https://api.brightsky.dev/alerts"

export type Severity = "minor" | "moderate" | "severe" | "extreme"

/** DWD-Warnstufe: 1 Wetterwarnung, 2 markant, 3 Unwetter, 4 extremes Unwetter */
export type WarningLevel = 1 | 2 | 3 | 4

const LEVELS: Record<Severity, WarningLevel> = { minor: 1, moderate: 2, severe: 3, extreme: 4 }

export interface Alert {
  id: string
  level: WarningLevel
  /** z. B. "ORKANBÖEN", "EXTREME HITZE" */
  event: string
  headline: string
  /** UTC in ms */
  onset: number
  /** UTC in ms, null wenn offen */
  expires: number | null
}

export function buildAlertsUrl(lat: number, lon: number): string {
  const r = (value: number) => Math.round(value * 1000) / 1000
  return `${BRIGHTSKY_ALERTS_URL}?lat=${r(lat)}&lon=${r(lon)}`
}

/** Liest die Bright-Sky-Antwort. Testmeldungen und unvollständige Einträge fallen weg. */
export function parseAlerts(body: unknown): Alert[] {
  if (!isRecord(body) || !Array.isArray(body["alerts"])) throw new Error("Antwort ohne Feld alerts")
  const alerts: Alert[] = []
  for (const raw of body["alerts"]) {
    if (!isRecord(raw) || raw["status"] === "test") continue
    const severity = raw["severity"]
    const onset = parseTime(raw["onset"])
    if (typeof severity !== "string" || !(severity in LEVELS) || onset === null) continue
    const event = typeof raw["event_de"] === "string" ? raw["event_de"] : typeof raw["event_en"] === "string" ? raw["event_en"].toUpperCase() : "WARNUNG"
    alerts.push({
      id: typeof raw["alert_id"] === "string" ? raw["alert_id"] : String(raw["id"]),
      level: LEVELS[severity as Severity],
      event,
      headline: typeof raw["headline_de"] === "string" ? raw["headline_de"] : event,
      onset,
      expires: parseTime(raw["expires"]),
    })
  }
  return alerts
}

/**
 * Warnungen ab `minLevel`, die gerade gelten oder innerhalb von `horizonHours`
 * beginnen. Sortiert nach Stufe (höchste zuerst), dann nach Beginn.
 */
export function relevantAlerts(alerts: Alert[], now: number, minLevel: WarningLevel = 3, horizonHours = 24): Alert[] {
  const horizon = now + horizonHours * 3_600_000
  return alerts
    .filter((a) => a.level >= minLevel && a.onset <= horizon && (a.expires === null || a.expires > now))
    .sort((a, b) => b.level - a.level || a.onset - b.onset)
}

/** Kurztext für die Warnzeile: "ORKANBÖEN bis 18:00" oder "ORKANBÖEN ab morgen 06:00". */
export function alertText(alert: Alert, now: number): string {
  if (alert.onset > now) return `${alert.event} ab ${dayPrefix(alert.onset, now)}${formatClock(alert.onset)}`
  if (alert.expires !== null) return `${alert.event} bis ${dayPrefix(alert.expires, now)}${formatClock(alert.expires)}`
  return alert.event
}

/** "" für heute, "morgen " oder "27.11. " für spätere Tage (Gerätezeit). */
function dayPrefix(time: number, now: number): string {
  const days = localDayNumber(time) - localDayNumber(now)
  if (days <= 0) return ""
  if (days === 1) return "morgen "
  const date = new Date(time)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}. `
}

function localDayNumber(time: number): number {
  const d = new Date(time)
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
