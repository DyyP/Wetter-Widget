import { describe, expect, it } from "vitest"
import { formatClock, formatDayMonth, formatRelativeDay, formatThousands, maskSecret, pad2 } from "../Wetter/core/format"

// Lokale Zeit über den Date-Konstruktor: unabhängig von der Zeitzone der Testumgebung
const local = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()

describe("Zahlen", () => {
  it("setzt Tausenderpunkte und führende Nullen", () => {
    expect(formatThousands(8000)).toBe("8.000")
    expect(formatThousands(10_000_000)).toBe("10.000.000")
    expect(formatThousands(-12345.6)).toBe("-12.346")
    expect(pad2(7)).toBe("07")
    expect(pad2(12)).toBe("12")
  })
})

describe("Zeitangaben", () => {
  const now = local(25, 9, 30)

  it("formatiert Uhrzeit und Datum", () => {
    expect(formatClock(local(25, 7, 5))).toBe("07:05")
    expect(formatDayMonth(local(2, 8))).toBe("02.11.")
  })

  it("nennt heute, gestern oder das Datum", () => {
    expect(formatRelativeDay(local(25, 0, 1), now)).toBe("heute 00:01")
    expect(formatRelativeDay(local(24, 23, 10), now)).toBe("gestern 23:10")
    expect(formatRelativeDay(local(2, 8, 0), now)).toBe("02.11. 08:00")
  })
})

describe("maskSecret", () => {
  it("zeigt nur die letzten 4 Zeichen", () => {
    expect(maskSecret("abcdef123456")).toBe("••••3456")
    expect(maskSecret(" abc ")).toBe("••••")
    expect(maskSecret("")).toBe("fehlt")
    expect(maskSecret(null)).toBe("fehlt")
  })
})
