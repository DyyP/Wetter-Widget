/**
 * Baut aus den gespeicherten Daten, was das Widget zeigt. Läuft bei jedem
 * Durchlauf neu, deshalb stimmt „JETZT“ auch ohne neuen Abruf.
 * Reine Logik ohne Scripting-APIs.
 */

import { alertText, relevantAlerts, type Alert, type WarningLevel } from "./dwd"
import { formatClock, formatRelativeDay } from "./format"
import { addDays, localDateString, weekday } from "./geo"
import type { Forecast, HourlyPoint } from "./meteoblue"
import { dailyIconName, hourlyIconName, isDailyPictocode, isHourlyPictocode } from "./picto"
import { sunTimes } from "./sun"
import { qualityLabel, qualityLevel, type QualityLevel, type SunEvent, type SunEventType } from "./sunsethue"

/** Stunden-Spalten plus höchstens ein Sonnen-Slot */
export const SLOT_COUNT = 6
export const DAY_COUNT = 5
/** Ein gerade vergangenes Sonnenereignis bleibt so lange sichtbar (wie bisher) */
const SUN_GRACE_MS = 10 * 60_000
/** Ab diesem Alter der Daten erscheint ein dezenter Hinweis */
const STALE_AFTER_MS = 12 * 3_600_000
const WEEKDAYS = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"]

export interface HourSlot {
  kind: "hour"
  /** "JETZT" oder "15:00" */
  label: string
  isNow: boolean
  /** Dateiname des meteoblue-Icons */
  icon: string
  temperature: number
  feltTemperature: number
  /** "0.4" oder null bei 0 mm */
  rain: string | null
}

export interface SunSlot {
  kind: "sun"
  type: SunEventType
  /** "16:38" */
  label: string
  /** Wetter der Stunde des Ereignisses, immer als Tag-Variante */
  icon: string
  /** 0–1, null ohne Sunsethue-Daten */
  quality: number | null
  qualityLabel: string | null
  level: QualityLevel | null
}

export type Slot = HourSlot | SunSlot

export interface DayColumn {
  /** "HEUTE", "MO", … */
  label: string
  icon: string
  max: number
  min: number
  /** "1.2mm" oder null bei 0 mm */
  rain: string | null
  /** Qualität des Sonnenuntergangs, falls Sunsethue sie für den Tag kennt */
  sunsetLevel: QualityLevel | null
}

export interface WarningRow {
  text: string
  level: WarningLevel
}

export interface WidgetModel {
  slots: Slot[]
  days: DayColumn[]
  /**
   * Ob die Stundenreihe ihre 4. Zeile braucht: bei Regen oder wenn ein
   * Sonnen-Slot da ist (dessen Bewertung steht in dieser Zeile).
   */
  hourRainRow: boolean
  /** Ob die Tagesreihe eine Regenzeile braucht */
  dayRainRow: boolean
  warning: WarningRow | null
  /** "Stand gestern 17:02", nur wenn die Daten älter als 12 Stunden sind */
  staleHint: string | null
  /** Wann das Widget frühestens neu gezeichnet werden soll: Beginn der nächsten Stunde */
  nextRefresh: number
}

export type ModelResult = { ok: true; model: WidgetModel } | { ok: false; reason: "no-data" | "outdated" }

export interface ModelInput {
  now: number
  forecast: Forecast | null
  /** Zeitpunkt des meteoblue-Abrufs */
  fetchedAt: number | null
  sunEvents: SunEvent[]
  alerts: Alert[]
}

export function buildModel(input: ModelInput): ModelResult {
  const { now, forecast } = input
  if (forecast === null) return { ok: false, reason: "no-data" }

  const nowIndex = forecast.hourly.findIndex((h) => h.time <= now && now < h.time + 3_600_000)
  if (nowIndex < 0) return { ok: false, reason: "outdated" }
  const hours = forecast.hourly.slice(nowIndex, nowIndex + SLOT_COUNT).filter((h) => isHourlyPictocode(h.pictocode))

  const slots: Slot[] = hours.map((hour, i) => hourSlot(hour, i === 0))
  const sun = nextSunSlot(input, forecast, hours)
  if (sun !== null) {
    const at = hours.findIndex((h) => h.time > sun.time)
    slots.splice(at < 0 ? slots.length : at, 0, sun.slot)
  }

  const warningAlert = relevantAlerts(input.alerts, now)[0]
  const warning = warningAlert === undefined ? null : { text: alertText(warningAlert, now), level: warningAlert.level }
  const stale = input.fetchedAt !== null && now - input.fetchedAt > STALE_AFTER_MS ? input.fetchedAt : null

  const visibleSlots = slots.slice(0, SLOT_COUNT)
  const days = dayColumns(forecast, input.sunEvents, now)
  return {
    ok: true,
    model: {
      slots: visibleSlots,
      days,
      hourRainRow: visibleSlots.some((slot) => slot.kind === "sun" || slot.rain !== null),
      dayRainRow: days.some((day) => day.rain !== null),
      warning,
      staleHint: stale === null ? null : `Stand ${formatRelativeDay(stale, now)}`,
      nextRefresh: startOfNextHour(now),
    },
  }
}

/** Alle Icons, die ein Modell braucht */
export function modelIconNames(model: WidgetModel): string[] {
  return [...model.slots.map((slot) => slot.icon), ...model.days.map((day) => day.icon)]
}

function hourSlot(hour: HourlyPoint, isNow: boolean): HourSlot {
  return {
    kind: "hour",
    label: isNow ? "JETZT" : `${formatClock(hour.time).slice(0, 2)}:00`,
    isNow,
    icon: hourlyIconName(hour.pictocode, hour.isDaylight),
    temperature: roundTemperature(hour.temperature),
    feltTemperature: roundTemperature(hour.feltTemperature),
    rain: formatRain(hour.precipitation),
  }
}

/**
 * Nächstes Sonnenereignis im sichtbaren Zeitraum. Die Zeit kommt von
 * Sunsethue, ohne Sunsethue aus der eigenen Berechnung.
 */
function nextSunSlot(input: ModelInput, forecast: Forecast, hours: HourlyPoint[]): { time: number; slot: SunSlot } | null {
  // Der Sonnen-Slot verdrängt die letzte Stunde. Damit er selbst sichtbar
  // bleibt, muss das Ereignis vor dem Ende der vorletzten Stunde liegen.
  const lastVisible = hours[Math.min(hours.length, SLOT_COUNT - 1) - 1]
  if (lastVisible === undefined) return null
  const windowEnd = lastVisible.time + 3_600_000
  const today = localDateString(input.now)

  const candidates: { type: SunEventType; time: number; event: SunEvent | null }[] = []
  for (const date of [today, addDays(today, 1)]) {
    const local = sunTimes(date, forecast.latitude, forecast.longitude)
    for (const type of ["sunrise", "sunset"] as const) {
      const event = input.sunEvents.find((e) => e.date === date && e.type === type) ?? null
      const time = event?.time ?? local[type]
      if (time !== null) candidates.push({ type, time, event })
    }
  }

  const next = candidates
    .filter((c) => c.time >= input.now - SUN_GRACE_MS && c.time < windowEnd)
    .sort((a, b) => a.time - b.time)[0]
  if (next === undefined) return null

  const hour = hours.find((h) => h.time <= next.time && next.time < h.time + 3_600_000) ?? hours[0]
  if (hour === undefined) return null
  const quality = next.event?.quality ?? null
  return {
    time: next.time,
    slot: {
      kind: "sun",
      type: next.type,
      label: formatClock(next.time),
      icon: hourlyIconName(hour.pictocode, true),
      quality,
      qualityLabel: quality === null ? null : qualityLabel(quality, next.event?.qualityText ?? null),
      level: quality === null ? null : qualityLevel(quality),
    },
  }
}

function dayColumns(forecast: Forecast, sunEvents: SunEvent[], now: number): DayColumn[] {
  const today = localDateString(now)
  const days = forecast.daily.filter((d) => d.date >= today && isDailyPictocode(d.pictocode)).slice(0, DAY_COUNT)
  return days.map((day) => {
    const sunset = sunEvents.find((e) => e.type === "sunset" && e.date === day.date)
    return {
      label: day.date === today ? "HEUTE" : (WEEKDAYS[weekday(day.date)] ?? ""),
      icon: dailyIconName(day.pictocode),
      max: roundTemperature(day.temperatureMax),
      min: roundTemperature(day.temperatureMin),
      rain: formatRain(day.precipitation, "mm"),
      sunsetLevel: typeof sunset?.quality === "number" ? qualityLevel(sunset.quality) : null,
    }
  })
}

/** Wie im bisherigen Widget: auf 0,1 mm runden, 0 mm nicht anzeigen. */
export function formatRain(mm: number, unit = ""): string | null {
  const rounded = Math.round(mm * 10) / 10
  return rounded > 0 ? `${rounded.toFixed(1)}${unit}` : null
}

/** Ganze Grad, ohne „-0“. */
export function roundTemperature(value: number): number {
  const rounded = Math.round(value)
  return rounded === 0 ? 0 : rounded
}

export function startOfNextHour(now: number): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime()
}
