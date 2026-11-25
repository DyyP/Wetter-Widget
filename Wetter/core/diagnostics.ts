/**
 * Diagnose-Helfer für Meilenstein 1: Keys maskiert anzeigen und messen, wie
 * oft iOS das Widget tatsächlich neu zeichnet. Reine Logik, ohne Scripting-APIs.
 */

import { formatRelativeDay, formatThousands } from "./format"

/** Zeigt nur die letzten 4 Zeichen eines Schlüssels. */
export function maskSecret(value: string | null): string {
  if (value === null || value.trim() === "") return "fehlt"
  const trimmed = value.trim()
  return trimmed.length <= 4 ? "••••" : `••••${trimmed.slice(-4)}`
}

/** Ein Eintrag pro Widget-Durchlauf. */
export interface RenderEntry {
  /** Zeitpunkt des Durchlaufs, UTC in ms */
  time: number
  family: string
  width: number
  height: number
}

/** Eine Zeile im Protokoll: `zeit;family;breite;höhe` */
export function formatRenderEntry(entry: RenderEntry): string {
  return `${entry.time};${entry.family};${round1(entry.width)};${round1(entry.height)}\n`
}

/** Liest das Protokoll und überspringt beschädigte Zeilen. */
export function parseRenderLog(text: string): RenderEntry[] {
  const entries: RenderEntry[] = []
  for (const line of text.split("\n")) {
    const [time, family, width, height] = line.trim().split(";")
    if (time === undefined || family === undefined || width === undefined || height === undefined) continue
    const entry = { time: Number(time), family, width: Number(width), height: Number(height) }
    if ([entry.time, entry.width, entry.height].every(Number.isFinite)) entries.push(entry)
  }
  return entries.sort((a, b) => a.time - b.time)
}

export interface RenderStats {
  /** Durchläufe in den letzten 24 Stunden */
  last24h: number
  /** Median des Abstands zwischen Durchläufen der letzten 24 Stunden, in Minuten */
  medianGapMinutes: number | null
  /** Größter Abstand der letzten 24 Stunden, in Minuten */
  maxGapMinutes: number | null
  /** Letzter Durchlauf */
  last: RenderEntry | null
}

export function summarizeRenders(entries: RenderEntry[], now: number): RenderStats {
  const dayAgo = now - 24 * 3_600_000
  const recent = entries.filter((e) => e.time >= dayAgo && e.time <= now)
  const gaps: number[] = []
  for (let i = 1; i < recent.length; i++) {
    const previous = recent[i - 1]
    const current = recent[i]
    if (previous && current) gaps.push((current.time - previous.time) / 60_000)
  }
  return {
    last24h: recent.length,
    medianGapMinutes: gaps.length > 0 ? round1(median(gaps)) : null,
    maxGapMinutes: gaps.length > 0 ? round1(Math.max(...gaps)) : null,
    last: entries.at(-1) ?? null,
  }
}

/** Behält nur die jüngsten Einträge, damit die Datei nicht endlos wächst. */
export function trimRenderLog(entries: RenderEntry[], maxEntries: number): string {
  return entries.slice(-maxEntries).map(formatRenderEntry).join("")
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return upper
  return ((sorted[mid - 1] ?? upper) + upper) / 2
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/** Ergebnis des Test-Abrufs, wie es App und Widget anzeigen. */
export interface ProbeSummary {
  /** Zeitpunkt des Abrufs, UTC in ms */
  time: number
  ok: boolean
  /** HTTP-Status oder null bei Netzwerkfehler */
  status: number | null
  /** Abgerechnete Credits laut Antwort-Header, falls gemeldet */
  credits: number | null
  hours: number
  days: number
  modelRunUpdateUtc: string | null
  durationMs: number
  error: string | null
}

/** Eine Zeile zum letzten Test-Abruf, für App-Status und Widget. */
export function probeLine(probe: ProbeSummary | null, now: number): string {
  if (probe === null) return "Test-Abruf: noch nicht gemacht"
  const when = formatRelativeDay(probe.time, now)
  if (!probe.ok) return `Test-Abruf ${when}: fehlgeschlagen. ${probe.error ?? ""}`.trim()
  const credits = probe.credits === null ? "Credits nicht gemeldet" : `${formatThousands(probe.credits)} Credits`
  return `Test-Abruf ${when}: ok, ${credits}, ${probe.hours} h / ${probe.days} Tage`
}
