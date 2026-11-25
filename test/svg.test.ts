import { describe, expect, it } from "vitest"
import { flattenSvg } from "../Wetter/core/svg"

// Selbst gebautes SVG im Aufbau der meteoblue-Pictogramme (keine meteoblue-Grafik)
const CLOUD = [
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="480" height="420"',
  ' style="shape-rendering:geometricPrecision;fill-rule:evenodd">',
  "<defs>",
  '<path id="a" d="M0 0h10v10z" style="stroke:inherit;stroke-linecap:round"/>',
  '<use xlink:href="#a" id="b" style="stroke-width:18" transform="matrix(.5 0 0 .5 100 50)"/>',
  '<g id="g" style="display:initial!important"><path d="M1 1h2" style="stroke:#fff;stroke-width:3"/><path d="M2 2h4" opacity=".4" style="fill:#023557;opacity:.5"/></g>',
  "</defs>",
  '<use xlink:href="#g"/>',
  '<use xlink:href="#a" style="stroke:#023557;stroke-width:12;fill:#b3b3b3"/>',
  '<use xlink:href="#b" style="stroke:#023557;fill:#ccc" transform="translate(0 -15)"/>',
  "</svg>",
].join("")

describe("flattenSvg", () => {
  const flat = flattenSvg(CLOUD)

  it("ersetzt alle Verweise durch Pfade in Zeichenreihenfolge", () => {
    expect(flat).not.toContain("<use")
    expect(flat).not.toContain("<defs")
    expect(flat.match(/<path /g)).toHaveLength(4)
    expect(flat.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="420">')).toBe(true)
  })

  it("überträgt die Farben vom <use> auf die Wolke und löst „inherit“ auf", () => {
    expect(flat).toContain(
      '<path d="M0 0h10v10z" style="shape-rendering:geometricPrecision;fill-rule:evenodd;stroke:#023557;stroke-width:12;fill:#b3b3b3;stroke-linecap:round"/>',
    )
  })

  it("verkettet Transformationen und lässt die innere Strichstärke gewinnen", () => {
    // translate(0 -15) × matrix(.5 0 0 .5 100 50) = matrix(.5 0 0 .5 100 35)
    expect(flat).toContain('stroke:#023557;fill:#ccc;stroke-width:18;stroke-linecap:round" transform="matrix(0.5 0 0 0.5 100 35)"/>')
  })

  it("behält Pfade aus Gruppen mit eigener Deckkraft, ohne display", () => {
    expect(flat).toContain('<path d="M1 1h2" style="shape-rendering:geometricPrecision;fill-rule:evenodd;stroke:#fff;stroke-width:3"/>')
    expect(flat).toContain('<path d="M2 2h4" style="shape-rendering:geometricPrecision;fill-rule:evenodd;fill:#023557;opacity:.5" opacity=".4"/>')
    expect(flat).not.toContain("display")
  })

  it("meldet kaputte Verweise", () => {
    expect(() => flattenSvg('<svg width="1" height="1"><use xlink:href="#x"/></svg>')).toThrow(/#x/)
    expect(() => flattenSvg("<div/>")).toThrow(/svg/)
  })
})
