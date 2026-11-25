import { describe, expect, it } from "vitest"
import { gridFor } from "../Wetter/ui/theme"

describe("gridFor", () => {
  it("nutzt die ganze Breite deines Widgets (334 pt) abzüglich 6 pt Rand", () => {
    const grid = gridFor(334)
    expect(grid.rowWidth).toBe(322)
    expect(grid.hourColumnWidth * 6).toBeCloseTo(322)
    expect(grid.dayColumnWidth * 5).toBeCloseTo(322)
    expect(grid.hourIconWidth).toBeCloseTo(36 * (322 / 312))
  })

  it("fällt nie unter das bisherige Raster von 312 pt", () => {
    expect(gridFor(0)).toEqual({ rowWidth: 312, hourColumnWidth: 52, dayColumnWidth: 62.4, hourIconWidth: 36, dayIconWidth: 30 })
    expect(gridFor(300).rowWidth).toBe(312)
  })
})
