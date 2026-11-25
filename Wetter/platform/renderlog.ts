/** Protokoll der Widget-Durchläufe: zeigt, wie oft iOS das Widget neu zeichnet. */

import { formatRenderEntry, parseRenderLog, trimRenderLog, type RenderEntry } from "../core/diagnostics"
import { appendText, readText, sharedFiles, writeText } from "./storage"

const MAX_ENTRIES = 500

export async function recordRender(entry: RenderEntry): Promise<RenderEntry[]> {
  await appendText(sharedFiles.renderLog, formatRenderEntry(entry))
  const entries = parseRenderLog((await readText(sharedFiles.renderLog)) ?? "")
  if (entries.length > MAX_ENTRIES * 1.2) await writeText(sharedFiles.renderLog, trimRenderLog(entries, MAX_ENTRIES))
  return entries
}

export async function readRenders(): Promise<RenderEntry[]> {
  return parseRenderLog((await readText(sharedFiles.renderLog)) ?? "")
}
