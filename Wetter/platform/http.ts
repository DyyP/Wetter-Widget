/** Netzwerkabruf mit Zeitlimit, Laufzeitmessung und allen Antwort-Headern. */

/** Lädt eine Textdatei, z. B. ein SVG-Icon. Wirft bei HTTP-Fehlern. */
export async function getText(url: string, timeoutSeconds = 10): Promise<string> {
  const response = await fetch(url, { method: "GET", timeout: timeoutSeconds })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

export interface HttpResult {
  status: number
  ok: boolean
  headers: [string, string][]
  /** Geparstes JSON oder null, wenn der Rumpf kein JSON ist */
  body: unknown
  /** Roher Rumpf, z. B. zum Speichern einer Testantwort */
  text: string
  durationMs: number
}

export interface GetOptions {
  timeoutSeconds?: number
  label?: string
  headers?: Record<string, string>
}

export async function getJson(url: string, options: GetOptions = {}): Promise<HttpResult> {
  const started = Date.now()
  const init: RequestInit = { method: "GET", timeout: options.timeoutSeconds ?? 15 }
  if (options.label !== undefined) init.debugLabel = options.label
  if (options.headers !== undefined) init.headers = options.headers
  const response = await fetch(url, init)
  const text = await response.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return {
    status: response.status,
    ok: response.ok,
    headers: response.headers.entries(),
    body,
    text,
    durationMs: Date.now() - started,
  }
}
