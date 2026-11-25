/**
 * Offizielle meteoblue-Icons. Ein Widget kann SVGs nicht selbst umrechnen,
 * das sprengt sein Speicherlimit (auf dem iPhone bestätigt). Deshalb rendert
 * die App alle Icons einmal in scharfe PNGs (3-fache Auflösung), und das
 * Widget zeigt nur diese fertigen Bilder. Vor dem Rendern werden die
 * `<use>`-Verweise aufgelöst, sonst zeichnet Scripting die Wolken schwarz.
 * Die Icons gehören meteoblue und liegen nur auf dem Gerät, nie im Repo.
 */

import { ImageRenderer, SVG } from "scripting"
import { PICTO_ASPECT, allIconNames, iconUrl } from "../core/picto"
import { flattenSvg } from "../core/svg"
import { getText } from "./http"
import { ensureDirectory, sharedDirectory } from "./storage"

/**
 * Bei jeder Änderung am Rendern hochzählen und den alten Ordner in
 * `obsoletePaths` eintragen. Bis zum nächsten „Jetzt aktualisieren“ in der
 * App fehlen dem Widget dann die Icons, es zeigt so lange einen Hinweis.
 */
const RENDER_VERSION = 2
const ICON_DIR = `${sharedDirectory}/icons-v${RENDER_VERSION}`
/** Die SVGs braucht nur das Rendern: Sie liegen im temporären Ordner der App. */
const SVG_DIR = `${FileManager.temporaryDirectory}/wetter-icons`
/** Render-Größe in pt. Reicht für die 37- und 31-pt-Icons im Widget. */
const RENDER_WIDTH = 48
const RENDER_SCALE = 3

const svgPath = (name: string) => `${SVG_DIR}/${name}`
const pngPath = (name: string) => `${ICON_DIR}/${name.replace(/\.svg$/, "")}@${RENDER_SCALE}x.png`

/** Reste älterer Versionen: Icon-Ordner bis 0.2.5 und SVGs, die bis 0.2.9 neben den PNGs lagen */
const obsoletePaths = () => [`${sharedDirectory}/icons`, ...allIconNames().map((name) => `${ICON_DIR}/${name}`)]

/** Für das Widget: Icon-Name → Pfad des fertigen PNG, nur für vorhandene Icons */
export async function renderedIcons(names: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(names)]
  const exists = await Promise.all(unique.map((name) => FileManager.exists(pngPath(name))))
  return new Map(unique.flatMap((name, i) => (exists[i] ? [[name, pngPath(name)] as [string, string]] : [])))
}

/**
 * Nur in der App: fehlende Icons laden (parallel) und rendern (nacheinander,
 * damit der Speicher klein bleibt). Liefert die Zahl fertiger Icons.
 */
export async function prepareIcons(): Promise<{ ready: number; total: number }> {
  await Promise.all(
    obsoletePaths().map(async (path) => {
      if (await FileManager.exists(path)) await FileManager.remove(path)
    }),
  )
  await Promise.all([ensureDirectory(ICON_DIR), ensureDirectory(SVG_DIR)])
  const names = allIconNames()
  const missing = (await Promise.all(names.map(async (name) => ((await FileManager.exists(pngPath(name))) ? null : name)))).filter(
    (name): name is string => name !== null,
  )

  await Promise.all(
    missing.map(async (name) => {
      if (await FileManager.exists(svgPath(name))) return
      try {
        await FileManager.writeAsString(svgPath(name), flattenSvg(await getText(iconUrl(name), 15)))
      } catch {
        // Download oder Format fehlgeschlagen: beim nächsten Aufruf erneut
      }
    }),
  )

  const height = Math.round(RENDER_WIDTH * PICTO_ASPECT * 10) / 10
  for (const name of missing) {
    if (!(await FileManager.exists(svgPath(name)))) continue
    const image = await ImageRenderer.toUIImage(
      <SVG filePath={svgPath(name)} resizable frame={{ width: RENDER_WIDTH, height }} />,
      { scale: RENDER_SCALE, opaque: false },
    )
    const png = image.toPNGData()
    if (png !== null) await FileManager.writeAsData(pngPath(name), png)
    await FileManager.remove(svgPath(name))
  }

  const ready = (await renderedIcons(names)).size
  return { ready, total: names.length }
}
