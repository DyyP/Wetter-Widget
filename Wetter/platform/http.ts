/** Netzwerkabruf mit Zeitlimit, Laufzeitmessung und allen Antwort-Headern. */

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

export async function getJson(url: string, options: { timeoutSeconds?: number; label?: string } = {}): Promise<HttpResult> {
  const started = Date.now()
  const init: RequestInit = { method: "GET", timeout: options.timeoutSeconds ?? 15 }
  if (options.label !== undefined) init.debugLabel = options.label
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
