import { describe, expect, it } from "vitest"
import { dailyIconName, hourlyIconName, iconUrl, isDailyPictocode, isHourlyPictocode } from "../Wetter/core/picto"

describe("meteoblue-Pictogramme", () => {
  it("benennt Stunden- und Tages-Icons wie auf meteoblue.com", () => {
    expect(hourlyIconName(7, true)).toBe("07_day.svg")
    expect(hourlyIconName(35, false)).toBe("35_night.svg")
    expect(dailyIconName(17)).toBe("17_iday.svg")
    expect(iconUrl("07_day.svg")).toBe("https://static.meteoblue.com/assets/images/picto/07_day.svg")
  })

  it("prüft die Wertebereiche", () => {
    expect(isHourlyPictocode(35)).toBe(true)
    expect(isHourlyPictocode(36)).toBe(false)
    expect(isDailyPictocode(18)).toBe(false)
    expect(() => hourlyIconName(0, true)).toThrow()
    expect(() => dailyIconName(1.5)).toThrow()
  })
})
