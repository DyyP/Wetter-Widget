import { describe, expect, it } from "vitest"
import { formatClock, formatMinutes, formatRelativeDay, formatThousands } from "../Wetter/core/format"

describe("formatThousands", () => {
  it("setzt Tausenderpunkte", () => {
    expect(formatThousands(8000)).toBe("8.000")
    expect(formatThousands(10_000_000)).toBe("10.000.000")
    expect(formatThousands(999)).toBe("999")
    expect(formatThousands(-12345.6)).toBe("-12.346")
  })
})

describe("Zeitangaben", () => {
  // Lokale Zeit über den Date-Konstruktor: unabhängig von der Zeitzone der Testumgebung
  const now = new Date(2026, 10, 25, 9, 30).getTime()

  it("formatiert Uhrzeiten zweistellig", () => {
    expect(formatClock(new Date(2026, 10, 25, 7, 5).getTime())).toBe("07:05")
  })

  it("nennt heute, gestern oder das Datum", () => {
    expect(formatRelativeDay(new Date(2026, 10, 25, 0, 1).getTime(), now)).toBe("heute 00:01")
    expect(formatRelativeDay(new Date(2026, 10, 24, 23, 10).getTime(), now)).toBe("gestern 23:10")
    expect(formatRelativeDay(new Date(2026, 10, 2, 8, 0).getTime(), now)).toBe("02.11. 08:00")
  })

  it("formatiert Minuten", () => {
    expect(formatMinutes(44.6)).toBe("45 min")
    expect(formatMinutes(125)).toBe("2 h 05 min")
  })
})
