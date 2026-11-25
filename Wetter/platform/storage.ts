/** JSON-Dateien im App-Group-Ordner, den App und Widget gemeinsam lesen. */

export const sharedDirectory = `${FileManager.appGroupDocumentsDirectory}/wetter-widget`

export async function ensureDirectory(path: string): Promise<void> {
  if (!(await FileManager.exists(path))) await FileManager.createDirectory(path, true)
}

/** Liest eine JSON-Datei. Fehlt sie oder ist sie beschädigt, kommt null. */
export async function readJson<T>(path: string): Promise<T | null> {
  try {
    if (!(await FileManager.exists(path))) return null
    return JSON.parse(await FileManager.readAsString(path)) as T
  } catch {
    return null
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDirectory(path.slice(0, path.lastIndexOf("/")))
  await FileManager.writeAsString(path, JSON.stringify(value))
}
