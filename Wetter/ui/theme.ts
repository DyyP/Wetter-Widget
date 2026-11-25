/**
 * Design-Tokens des Widgets. Werte aus deinem bisherigen Script, ergänzt um
 * die gewählten Vorschläge A (bündiges Raster), B (lesbarer Sonnen-Slot),
 * E (Warnung mit Klartext) und F (Sonnenuntergang an den Tagen).
 * Jede Änderung am Look beginnt hier.
 */

import type { WarningLevel } from "../core/dwd"
import type { QualityLevel } from "../core/sunsethue"

// Ohne `satisfies`: Scriptings TypeScript-Übersetzer muss nicht die neueste Syntax kennen.
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
    background: "#1c1c1e",
    text: "#ffffff",
    textDim: "rgba(255,255,255,0.65)",
    rain: "#5cb5ff",
    nowBackground: "rgba(255,255,255,0.07)",
    sunBackground: "rgba(36,24,0,0.9)",
    quality,
    warning,
  },
  layout: {
    /** Breite einer Stunden-Spalte, 6 Spalten = 312 pt */
    hourColumnWidth: 52,
    /** A: Tage teilen sich dieselbe Gesamtbreite wie die Stunden */
    dayColumnWidth: (52 * 6) / 5,
    hourIconWidth: 36,
    dayIconWidth: 30,
    slotCornerRadius: 8,
    slotPaddingVertical: 2,
    widgetPaddingVertical: 8,
    rowSpacing: 3,
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
    warning: 8,
  },
} as const
