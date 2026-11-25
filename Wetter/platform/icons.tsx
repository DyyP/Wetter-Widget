/**
 * Offizielle meteoblue-Icons. Das Widget kann SVGs nicht selbst umrechnen,
 * dabei sprengt es das Speicherlimit (auf dem iPhone bestätigt). Deshalb:
 * - In der App werden alle SVGs geladen und per ImageRenderer in scharfe PNGs
 *   (3-fache Auflösung) umgerechnet: `prepareIcons()`.
 * - Das Widget zeigt nur fertige PNGs. Fehlt eins, lädt es übergangsweise das
 *   kleine meteoblue-PNG (48 × 42 px).
 * Die Icons gehören meteoblue und liegen nur auf dem Gerät, nie im Repo.
 */

import { ImageRenderer, SVG } from "scripting"
import { iconUrl } from "../core/picto"
import { getText } from "./http"
import { ensureDirectory, sharedDirectory } from "./storage"

const ICON_DIR = `${sharedDirectory}/icons`

/** Größe, in der vorgerendert wird (pt). Reicht für 36- und 30-pt-Icons. */
const RENDER_WIDTH = 48
const RENDER_SCALE = 3

const svgPath = (name: string) => `${ICON_DIR}/${name}`
/** "07_day.svg" → vorgerendertes PNG */
export const renderedPath = (name: string) => `${ICON_DIR}/${name.replace(/\.svg$/, "")}@3x.png`
/** "07_day.svg" → kleines Original-PNG von meteoblue */
const smallPngName = (name: string) => name.replace(/\.svg$/, ".png")
const smallPngPath = (name: string) => `${ICON_DIR}/${smallPngName(name)}`

/** Alle Icon-Namen, die meteoblue verwendet */
export function allIconNames(): string[] {
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  const names: string[] = []
  for (let c = 1; c <= 35; c++) names.push(`${pad(c)}_day.svg`, `${pad(c)}_night.svg`)
  for (let c = 1; c <= 17; c++) names.push(`${pad(c)}_iday.svg`)
  return names
}

/**
 * Für das Widget: Liefert pro Icon-Name den Pfad eines zeichenbaren PNG.
 * Bevorzugt die vorgerenderte Version, sonst das kleine meteoblue-PNG
 * (wird bei Bedarf geladen). Fehlt beides, fehlt der Eintrag.
 */
export async function widgetIconPaths(names: string[]): Promise<Map<string, string>> {
  await ensureDirectory(ICON_DIR)
  const result = new Map<string, string>()
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      if (await FileManager.exists(renderedPath(name))) {
        result.set(name, renderedPath(name))
        return
      }
      if (!(await FileManager.exists(smallPngPath(name)))) {
        try {
          const response = await fetch(iconUrl(smallPngName(name)), { method: "GET", timeout: 8 })
          if (!response.ok) return
          await FileManager.writeAsData(smallPngPath(name), await response.data())
        } catch {
          return
        }
      }
      result.set(name, smallPngPath(name))
    }),
  )
  return result
}

/** Nur in der App: alle Icons laden und scharf vorrendern. Liefert die Anzahl fertiger Icons. */
export async function prepareIcons(onProgress?: (done: number, total: number) => void): Promise<number> {
  await ensureDirectory(ICON_DIR)
  const names = allIconNames()
  let done = 0
  for (const name of names) {
    try {
      if (!(await FileManager.exists(renderedPath(name)))) {
        if (!(await FileManager.exists(svgPath(name)))) {
          const svg = await getText(iconUrl(name))
          if (!svg.trimStart().startsWith("<")) continue
          await FileManager.writeAsString(svgPath(name), svg)
        }
        const height = Math.round(RENDER_WIDTH * (420 / 480) * 10) / 10
        const image = await ImageRenderer.toUIImage(
          <SVG filePath={svgPath(name)} resizable frame={{ width: RENDER_WIDTH, height }} />,
          { scale: RENDER_SCALE, opaque: false },
        )
        const png = image.toPNGData()
        if (png === null) continue
        await FileManager.writeAsData(renderedPath(name), png)
      }
      done++
    } catch {
      // einzelnes Icon überspringen, beim nächsten Mal erneut versuchen
    }
    onProgress?.(done, names.length)
  }
  return done
}
