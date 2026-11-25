/** Netzwerkabruf mit Zeitlimit. */

export interface JsonResponse {
  status: number
  ok: boolean
  headers: [string, string][]
  /** Geparstes JSON oder null, wenn der Rumpf kein JSON ist */
  body: unknown
}

export interface RequestOptions {
  timeoutSeconds: number
  headers?: Record<string, string>
}

export async function getJson(url: string, options: RequestOptions): Promise<JsonResponse> {
  const init: RequestInit = { method: "GET", timeout: options.timeoutSeconds }
  if (options.headers !== undefined) init.headers = options.headers
  const response = await fetch(url, init)
  const text = await response.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    body = null
  }
  return { status: response.status, ok: response.ok, headers: response.headers.entries(), body }
}

/** Lädt eine Textdatei. Wirft bei HTTP-Fehlern. */
export async function getText(url: string, timeoutSeconds: number): Promise<string> {
  const response = await fetch(url, { method: "GET", timeout: timeoutSeconds })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}
