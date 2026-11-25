/**
 * Dateien, die App und Widget teilen, liegen im App-Group-Ordner von
 * Scripting. Exporte für dich landen in iCloud Drive (oder lokal, wenn iCloud
 * aus ist), damit du sie in der Dateien-App findest.
 */

/** Gemeinsamer Ordner von App und Widget */
export const sharedDirectory = `${FileManager.appGroupDocumentsDirectory}/wetter-widget`

export const sharedFiles = {
  renderLog: `${sharedDirectory}/render-log.txt`,
  lastProbe: `${sharedDirectory}/last-probe.json`,
} as const

/** Ordner für Dateien, die du in der Dateien-App öffnen oder teilen kannst. */
export function exportDirectory(): string {
  const base = FileManager.isiCloudEnabled ? FileManager.iCloudDocumentsDirectory : FileManager.documentsDirectory
  return `${base}/Wetter-Widget`
}

export async function ensureDirectory(path: string): Promise<void> {
  if (!(await FileManager.exists(path))) await FileManager.createDirectory(path, true)
}

export async function readText(path: string): Promise<string | null> {
  try {
    if (!(await FileManager.exists(path))) return null
    return await FileManager.readAsString(path)
  } catch {
    return null
  }
}

export async function writeText(path: string, content: string): Promise<void> {
  await ensureDirectory(parentDirectory(path))
  await FileManager.writeAsString(path, content)
}

export async function appendText(path: string, content: string): Promise<void> {
  await ensureDirectory(parentDirectory(path))
  await FileManager.appendText(path, content)
}

export async function readJson<T>(path: string): Promise<T | null> {
  const text = await readText(path)
  if (text === null) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeText(path, JSON.stringify(value, null, 2))
}

function parentDirectory(path: string): string {
  return path.slice(0, path.lastIndexOf("/"))
}
