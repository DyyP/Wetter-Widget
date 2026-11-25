/**
 * Offizielle meteoblue-Icons: einmal von static.meteoblue.com laden, dann
 * dauerhaft im App-Group-Ordner behalten. Fehlt ein Icon und das Netz ist
 * weg, zeigt das Widget an der Stelle nichts statt eines falschen Symbols.
 */

import { iconUrl } from "../core/picto"
import { getText } from "./http"
import { ensureDirectory, sharedDirectory } from "./storage"

const ICON_DIR = `${sharedDirectory}/icons`

export function iconPath(name: string): string {
  return `${ICON_DIR}/${name}`
}

/**
 * Stellt sicher, dass die Icons lokal liegen. Liefert die Namen, die
 * verfügbar sind. Fehlende werden parallel nachgeladen.
 */
export async function ensureIcons(names: string[]): Promise<Set<string>> {
  await ensureDirectory(ICON_DIR)
  const unique = [...new Set(names)]
  const results = await Promise.all(
    unique.map(async (name) => {
      const path = iconPath(name)
      if (await FileManager.exists(path)) return name
      try {
        const svg = await getText(iconUrl(name))
        if (!svg.trimStart().startsWith("<svg") && !svg.trimStart().startsWith("<?xml")) return null
        await FileManager.writeAsString(path, svg)
        return name
      } catch {
        return null
      }
    }),
  )
  return new Set(results.filter((name): name is string => name !== null))
}
