/**
 * Amtliche Warnungen des Deutschen Wetterdienstes über Bright Sky
 * (https://brightsky.dev, kostenlos, ohne Key). `/alerts?lat=&lon=` liefert
 * die Warnungen der Gemeinde am Standort. Es gelten die Nutzungsbedingungen des DWD.
 */

import { formatClock, formatDayMonth, localDayNumber } from "./format"
import { round, type Coordinates } from "./geo"

export const BRIGHTSKY_ALERTS_URL = "https://api.brightsky.dev/alerts"

/** DWD-Warnstufe: 1 Wetterwarnung, 2 markant, 3 Unwetter, 4 extremes Unwetter */
export type WarningLevel = 1 | 2 | 3 | 4

const LEVELS: Record<string, WarningLevel> = { minor: 1, moderate: 2, severe: 3, extreme: 4 }

/** Ab dieser Stufe zeigt das Widget eine Warnung (deine Wahl: nur Unwetter) */
export const MIN_WARNING_LEVEL: WarningLevel = 3
/** Warnungen, die so bald beginnen, werden schon angekündigt */
const HORIZON_HOURS = 24

export interface Alert {
  level: WarningLevel
  /** z. B. "ORKANBÖEN", "EXTREME HITZE" */
  event: string
  /** UTC in ms */
  onset: number
  /** UTC in ms, null wenn offen */
  expires: number | null
}

export function buildAlertsUrl(place: Coordinates): string {
  return `${BRIGHTSKY_ALERTS_URL}?lat=${round(place.lat, 3)}&lon=${round(place.lon, 3)}`
}

/** Liest die Bright-Sky-Antwort. Testmeldungen und unvollständige Einträge fallen weg. */
export function parseAlerts(body: unknown): Alert[] {
  if (!isRecord(body) || !Array.isArray(body["alerts"])) throw new Error("Bright Sky: Antwort ohne Feld alerts")
  const alerts: Alert[] = []
  for (const raw of body["alerts"]) {
    if (!isRecord(raw) || raw["status"] === "test") continue
    const level = typeof raw["severity"] === "string" ? LEVELS[raw["severity"]] : undefined
    const onset = parseTime(raw["onset"])
    if (level === undefined || onset === null) continue
    const event = typeof raw["event_de"] === "string" ? raw["event_de"] : typeof raw["event_en"] === "string" ? raw["event_en"].toUpperCase() : "WARNUNG"
    alerts.push({ level, event, onset, expires: parseTime(raw["expires"]) })
  }
  return alerts
}

/** Gerade gültige oder bald beginnende Warnungen ab `minLevel`, höchste Stufe zuerst. */
export function relevantAlerts(alerts: Alert[], now: number, minLevel: WarningLevel = MIN_WARNING_LEVEL): Alert[] {
  const horizon = now + HORIZON_HOURS * 3_600_000
  return alerts
    .filter((a) => a.level >= minLevel && a.onset <= horizon && (a.expires === null || a.expires > now))
    .sort((a, b) => b.level - a.level || a.onset - b.onset)
}

/** "ORKANBÖEN bis 18:00", "ORKANBÖEN ab morgen 06:00" */
export function alertText(alert: Alert, now: number): string {
  if (alert.onset > now) return `${alert.event} ab ${dayPrefix(alert.onset, now)}${formatClock(alert.onset)}`
  if (alert.expires !== null) return `${alert.event} bis ${dayPrefix(alert.expires, now)}${formatClock(alert.expires)}`
  return alert.event
}

function dayPrefix(time: number, now: number): string {
  const days = localDayNumber(time) - localDayNumber(now)
  if (days <= 0) return ""
  if (days === 1) return "morgen "
  return `${formatDayMonth(time)} `
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? time : null
}
