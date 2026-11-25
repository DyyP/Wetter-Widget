/**
 * Löst `<use>`-Verweise in den meteoblue-SVGs auf.
 *
 * meteoblue zeichnet Wolken als Pfad in `<defs>` und färbt sie über das
 * `<use>`-Element, das auf den Pfad verweist (Vererbung von fill/stroke).
 * Der SVG-Renderer von Scripting vererbt diese Stile nicht, die Wolken
 * erscheinen dann schwarz. `flattenSvg` macht daraus reine Pfade, die ihre
 * endgültigen Stile und eine zusammengerechnete Transformation selbst tragen.
 *
 * Unterstützt genau den Aufbau der meteoblue-Pictogramme (geprüft an allen
 * 87 Icons, 11/2026): `<path>`, `<use>` und `<g>` mit `style`, `transform`
 * aus `matrix(…)`/`translate(…)` und `opacity` an Pfaden.
 */

type Style = Record<string, string>
/** Affine Matrix [a b c d e f] wie in SVG */
type Matrix = [number, number, number, number, number, number]

interface SvgNode {
  tag: "path" | "use" | "g"
  attrs: Record<string, string>
  children: SvgNode[]
}

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]
/** CSS-Eigenschaften, die an Kindelemente vererbt werden */
const INHERITED = new Set(["fill", "fill-rule", "clip-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "shape-rendering"])

export function flattenSvg(svg: string): string {
  const root = /<svg\b([^>]*)>/.exec(svg)
  if (!root) throw new Error("Kein <svg>-Element")
  const rootAttrs = parseAttributes(root[1] ?? "")
  const defsMatch = /<defs>([\s\S]*?)<\/defs>/.exec(svg)
  const definitions = new Map<string, SvgNode>()
  for (const node of parseNodes(defsMatch?.[1] ?? "")) {
    if (node.attrs["id"] !== undefined) definitions.set(node.attrs["id"], node)
  }
  const body = svg.slice(svg.indexOf(">", root.index) + 1, svg.lastIndexOf("</svg>")).replace(/<defs>[\s\S]*?<\/defs>/, "")

  const rootStyle = inherit({}, parseStyle(rootAttrs["style"] ?? ""))
  const paths = parseNodes(body).flatMap((node) => render(node, rootStyle, IDENTITY, definitions, 0))
  const size = ["width", "height"].map((key) => (rootAttrs[key] === undefined ? "" : ` ${key}="${rootAttrs[key]}"`)).join("")
  return `<svg xmlns="http://www.w3.org/2000/svg"${size}>${paths.join("")}</svg>`
}

function render(node: SvgNode, parent: Style, matrix: Matrix, definitions: Map<string, SvgNode>, depth: number): string[] {
  if (depth > 10) throw new Error("SVG-Verweise zu tief verschachtelt")
  const style = inherit(parent, parseStyle(node.attrs["style"] ?? ""))
  const transform = multiply(matrix, parseTransform(node.attrs["transform"] ?? ""))

  if (node.tag === "use") {
    const href = (node.attrs["xlink:href"] ?? node.attrs["href"] ?? "").replace(/^#/, "")
    const target = definitions.get(href)
    if (target === undefined) throw new Error(`Unbekannter SVG-Verweis #${href}`)
    return render(target, style, transform, definitions, depth + 1)
  }
  if (node.tag === "g") return node.children.flatMap((child) => render(child, style, transform, definitions, depth + 1))

  // Pfad: eigene, nicht vererbte Eigenschaften (Deckkraft) übernehmen
  const own = parseStyle(node.attrs["style"] ?? "")
  const declarations = { ...style, ...(own["opacity"] === undefined ? {} : { opacity: own["opacity"] }) }
  const attrs = [`d="${node.attrs["d"] ?? ""}"`, `style="${formatStyle(declarations)}"`]
  if (node.attrs["opacity"] !== undefined) attrs.push(`opacity="${node.attrs["opacity"]}"`)
  if (!isIdentity(transform)) attrs.push(`transform="matrix(${transform.map(formatNumber).join(" ")})"`)
  return [`<path ${attrs.join(" ")}/>`]
}

/** Vererbt die Eigenschaften des Elternteils; „inherit“ übernimmt dessen Wert. */
function inherit(parent: Style, own: Style): Style {
  const result: Style = {}
  for (const [key, value] of Object.entries(parent)) if (INHERITED.has(key)) result[key] = value
  for (const [key, value] of Object.entries(own)) {
    if (!INHERITED.has(key)) continue
    if (value !== "inherit") result[key] = value
  }
  return result
}

function parseNodes(markup: string): SvgNode[] {
  const nodes: SvgNode[] = []
  const pattern = /<(path|use|g)\b([^>]*?)(\/?)>/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(markup)) !== null) {
    const tag = match[1] as SvgNode["tag"]
    const attrs = parseAttributes(match[2] ?? "")
    if (match[3] === "/") {
      nodes.push({ tag, attrs, children: [] })
      continue
    }
    const close = markup.indexOf(`</${tag}>`, pattern.lastIndex)
    if (close < 0) throw new Error(`<${tag}> ohne Ende`)
    nodes.push({ tag, attrs, children: parseNodes(markup.slice(pattern.lastIndex, close)) })
    pattern.lastIndex = close + tag.length + 3
  }
  return nodes
}

function parseAttributes(text: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const match of text.matchAll(/([\w:-]+)="([^"]*)"/g)) {
    if (match[1] !== undefined) attrs[match[1]] = match[2] ?? ""
  }
  return attrs
}

function parseStyle(text: string): Style {
  const style: Style = {}
  for (const declaration of text.split(";")) {
    const colon = declaration.indexOf(":")
    if (colon < 0) continue
    const key = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).replace("!important", "").trim()
    if (key !== "" && value !== "") style[key] = value
  }
  return style
}

function formatStyle(style: Style): string {
  return Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(";")
}

function parseTransform(text: string): Matrix {
  let result = IDENTITY
  for (const match of text.matchAll(/(matrix|translate)\(([^)]*)\)/g)) {
    const values = (match[2] ?? "").trim().split(/[\s,]+/).map(Number)
    const next: Matrix =
      match[1] === "matrix"
        ? [values[0] ?? 1, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1, values[4] ?? 0, values[5] ?? 0]
        : [1, 0, 0, 1, values[0] ?? 0, values[1] ?? 0]
    result = multiply(result, next)
  }
  return result
}

/** m × n: erst n, dann m anwenden (wie verschachtelte SVG-Transformationen) */
function multiply(m: Matrix, n: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const [a2, b2, c2, d2, e2, f2] = n
  return [a * a2 + c * b2, b * a2 + d * b2, a * c2 + c * d2, b * c2 + d * d2, a * e2 + c * f2 + e, b * e2 + d * f2 + f]
}

function isIdentity(m: Matrix): boolean {
  return m.every((value, i) => value === IDENTITY[i])
}

function formatNumber(value: number): string {
  return String(Math.round(value * 10_000) / 10_000)
}
