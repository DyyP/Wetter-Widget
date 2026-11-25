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
    /** iOS-Dunkelgrau für Karten, etwas heller als das bisherige #1c1c1e */
    background: "#2c2c2e",
    /** Strich zwischen Stunden und Tagen, wie im bisherigen Script */
    divider: "rgba(255,255,255,0.28)",
    text: "#ffffff",
    textDim: "rgba(255,255,255,0.65)",
    rain: "#5cb5ff",
    nowBackground: "rgba(255,255,255,0.07)",
    sunBackground: "rgba(36,24,0,0.9)",
    quality,
    warning,
  },
  layout: {
    /** Gesamtbreite beider Reihen (A: bündiges Raster) */
    rowWidth: 312,
    /** 6 Spalten à 52 pt */
    hourColumnWidth: 312 / 6,
    /** 5 Spalten à 62,4 pt */
    dayColumnWidth: 312 / 5,
    hourIconWidth: 36,
    dayIconWidth: 30,
    slotCornerRadius: 8,
    slotPaddingVertical: 2,
    widgetPaddingVertical: 8,
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
