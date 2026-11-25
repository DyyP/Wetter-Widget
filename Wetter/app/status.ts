/** Statusübersicht im App-Menü: Keys, letzter Test-Abruf, Widget-Aktualisierungen. */

import type { ProbeSummary } from "../core/diagnostics"
import { maskSecret, parseRenderLog, probeLine, summarizeRenders } from "../core/diagnostics"
import { formatMinutes, formatRelativeDay } from "../core/format"
import { readSecret } from "../platform/secrets"
import { readJson, readText, sharedFiles } from "../platform/storage"

export async function showStatus(): Promise<void> {
  const now = Date.now()
  const probe = await readJson<ProbeSummary>(sharedFiles.lastProbe)
  const renders = summarizeRenders(parseRenderLog((await readText(sharedFiles.renderLog)) ?? ""), now)

  const lines = [
    `meteoblue-Key: ${maskSecret(readSecret("meteoblue"))}`,
    `Sunsethue-Key: ${maskSecret(readSecret("sunsethue"))}`,
    "",
    probeLine(probe, now),
    "",
    renders.last === null
      ? "Widget: noch nie gezeichnet. Leg es auf den Home-Bildschirm."
      : `Widget zuletzt ${formatRelativeDay(renders.last.time, now)} (${renders.last.family}, ${renders.last.width}×${renders.last.height} pt)`,
  ]
  if (renders.last24h > 0) {
    lines.push(`In 24 h ${renders.last24h}× neu gezeichnet`)
    if (renders.medianGapMinutes !== null && renders.maxGapMinutes !== null) {
      lines.push(`Abstand typisch ${formatMinutes(renders.medianGapMinutes)}, längste Pause ${formatMinutes(renders.maxGapMinutes)}`)
    }
  }

  await Dialog.alert({ title: "Status", message: lines.join("\n") })
}
