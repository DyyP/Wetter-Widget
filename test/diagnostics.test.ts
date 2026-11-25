import { describe, expect, it } from "vitest"
import {
  formatRenderEntry,
  maskSecret,
  parseRenderLog,
  probeLine,
  summarizeRenders,
  trimRenderLog,
  type ProbeSummary,
  type RenderEntry,
} from "../Wetter/core/diagnostics"

const MIN = 60_000

function entry(time: number): RenderEntry {
  return { time, family: "systemMedium", width: 329, height: 155 }
}

describe("maskSecret", () => {
  it("zeigt nur die letzten 4 Zeichen", () => {
    expect(maskSecret("abcdef123456")).toBe("••••3456")
    expect(maskSecret(" abc ")).toBe("••••")
    expect(maskSecret("")).toBe("fehlt")
    expect(maskSecret(null)).toBe("fehlt")
  })
})

describe("Render-Protokoll", () => {
  it("schreibt und liest Einträge, kaputte Zeilen werden übersprungen", () => {
    const text = formatRenderEntry(entry(2000)) + "kaputt\n" + formatRenderEntry(entry(1000)) + "1;x;y;z\n"
    expect(parseRenderLog(text)).toEqual([entry(1000), entry(2000)])
  })

  it("fasst die letzten 24 Stunden zusammen", () => {
    const now = Date.UTC(2026, 10, 25, 12, 0)
    const log = [now - 30 * 60 * MIN, now - 60 * MIN, now - 40 * MIN, now - 10 * MIN, now].map(entry)
    const stats = summarizeRenders(log, now)
    expect(stats.last24h).toBe(4)
    expect(stats.medianGapMinutes).toBe(20)
    expect(stats.maxGapMinutes).toBe(30)
    expect(stats.last?.time).toBe(now)
  })

  it("ignoriert Mehrfachzeichnungen direkt hintereinander", () => {
    const now = Date.UTC(2026, 10, 25, 12, 0)
    const log = [now - 60 * MIN, now - 59.8 * MIN, now - 59.5 * MIN, now - 30 * MIN, now].map(entry)
    const stats = summarizeRenders(log, now)
    expect(stats.last24h).toBe(5)
    // Abstände 0,2 und 0,3 min fallen weg, bleiben 29,5 und 30 min
    expect(stats.medianGapMinutes).toBe(29.8)
  })

  it("kommt mit leerem Protokoll aus", () => {
    expect(summarizeRenders([], 0)).toEqual({ last24h: 0, medianGapMinutes: null, maxGapMinutes: null, last: null })
  })

  it("kürzt auf die jüngsten Einträge", () => {
    const trimmed = parseRenderLog(trimRenderLog([1, 2, 3, 4].map(entry), 2))
    expect(trimmed.map((e) => e.time)).toEqual([3, 4])
  })
})

describe("probeLine", () => {
  const now = new Date(2026, 10, 25, 9, 30).getTime()
  const base: ProbeSummary = {
    time: new Date(2026, 10, 25, 7, 5).getTime(),
    ok: true,
    status: 200,
    credits: 8000,
    hours: 168,
    days: 8,
    modelRunUpdateUtc: null,
    durationMs: 640,
    error: null,
  }

  it("beschreibt einen erfolgreichen Abruf", () => {
    expect(probeLine(base, now)).toBe("Test-Abruf heute 07:05: ok, 8.000 Credits, 168 h / 8 Tage")
    expect(probeLine({ ...base, credits: null }, now)).toContain("Credits nicht gemeldet")
  })

  it("beschreibt Fehler und fehlende Abrufe", () => {
    expect(probeLine({ ...base, ok: false, error: "Key abgelaufen" }, now)).toBe(
      "Test-Abruf heute 07:05: fehlgeschlagen. Key abgelaufen",
    )
    expect(probeLine(null, now)).toBe("Test-Abruf: noch nicht gemacht")
  })
})
