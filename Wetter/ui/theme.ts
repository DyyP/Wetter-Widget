/**
 * Design-Tokens des Widgets. Werte aus deinem bisherigen Script, ergänzt um
 * die gewählten Vorschläge A (bündiges Raster), B (lesbarer Sonnen-Slot),
 * E (Warnung mit Klartext) und F (Sonnenuntergang an den Tagen).
 * Jede Änderung am Look beginnt hier.
 */

import type { WarningLevel } from "../core/dwd"
import type { QualityLevel } from "../core/sunsethue"

const quality: Record<QualityLevel, string> = {
  high: "#ff9f0a",
  medium: "#ffd60a",
  low: "rgba(255,255,255,0.45)",
}

/** Angelehnt an die DWD-Warnfarben */
const warning: Record<WarningLevel, string> = {
  1: "#ffd60a",
  2: "#ff9f0a",
  3: "#ff453a",
  4: "#bf5af2",
}

export const theme = {
  colors: {
    /** Zwischen dem bisherigen #1c1c1e und dem iOS-Kartengrau #2c2c2e */
    background: "#242426",
    /** Strich zwischen Stunden und Tagen, wie im bisherigen Script */
    divider: "rgba(255,255,255,0.28)",
    text: "#ffffff",
    textDim: "rgba(255,255,255,0.65)",
    rain: "#5cb5ff",
    /** Hinweis am Trenner, der ein Eingreifen braucht (meteoblue-Key prüfen) */
    notice: "#ff9f0a",
    nowBackground: "rgba(255,255,255,0.07)",
    sunBackground: "rgba(36,24,0,0.9)",
    quality,
    warning,
  },
  layout: {
    /** Abstand der Reihen zum linken und rechten Widget-Rand */
    sideMargin: 6,
    /** Innenabstand oben und unten */
    widgetPaddingVertical: 6,
    slotCornerRadius: 8,
    slotPaddingVertical: 2,
    rowSpacing: 3,
    dividerHeight: 10,
    sunsetDotSize: 4,
  },

  fonts: {
    label: 8,
    temperature: 11,
    felt: 9,
    rain: 8,
    /** B: Bewertung im Sonnen-Slot, vorher 7 pt */
    qualityLabel: 8,
    sunGlyph: 7,
    /** Text am Trenner (Warnung oder Datenstand) */
    divider: 8,
  },
} as const

/**
 * Raster des bisherigen Scripts: 6 Stunden à 52 pt und 5 Tage à 62,4 pt
 * auf 312 pt Breite (A: bündig), Icons 36 und 30 pt breit. Auf breiteren
 * Widgets wächst alles im selben Verhältnis.
 */
const BASE = { rowWidth: 312, hourIconWidth: 36, dayIconWidth: 30 }

export interface Grid {
  rowWidth: number
  hourColumnWidth: number
  dayColumnWidth: number
  hourIconWidth: number
  dayIconWidth: number
}

/** Raster für die tatsächliche Widget-Breite in pt */
export function gridFor(widgetWidth: number): Grid {
  const rowWidth = widgetWidth > 0 ? Math.max(BASE.rowWidth, widgetWidth - 2 * theme.layout.sideMargin) : BASE.rowWidth
  const scale = rowWidth / BASE.rowWidth
  return {
    rowWidth,
    hourColumnWidth: rowWidth / 6,
    dayColumnWidth: rowWidth / 5,
    hourIconWidth: BASE.hourIconWidth * scale,
    dayIconWidth: BASE.dayIconWidth * scale,
  }
}
