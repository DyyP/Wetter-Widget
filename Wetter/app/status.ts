/** Statusübersicht im App-Menü: Keys, Abrufe, Budget, Widget-Aktualisierungen. */

import { maskSecret, summarizeRenders } from "../core/diagnostics"
import { formatMinutes, formatRelativeDay } from "../core/format"
import { DEFAULT_METEOBLUE_PLAN, type SourceState } from "../core/planner"
import { loadPlanner } from "../platform/cache"
import { readRenders } from "../platform/renderlog"
import { readSecret } from "../platform/secrets"

export async function showStatus(): Promise<void> {
  const now = Date.now()
  const store = await loadPlanner()
  const renders = summarizeRenders(await readRenders(), now)
  const weekCalls = store.meteoblue.billedCalls.filter((t) => t > now - 7 * 86_400_000).length

  const lines = [
    `meteoblue-Key: ${maskSecret(readSecret("meteoblue"))}`,
    `Sunsethue-Key: ${maskSecret(readSecret("sunsethue"))}`,
    "",
    `meteoblue: ${sourceLine(store.meteoblue, now)}`,
    `Abrufe in 7 Tagen: ${weekCalls} von ${DEFAULT_METEOBLUE_PLAN.weeklyBudget}`,
    `Sunsethue: ${sourceLine(store.sunsethue, now)}`,
    `DWD-Warnungen: ${sourceLine(store.warnings, now)}`,
    "",
  ]
  if (renders.last === null) lines.push("Widget: noch nie gezeichnet")
  else {
    lines.push(`Widget zuletzt ${formatRelativeDay(renders.last.time, now)} (${renders.last.width}×${renders.last.height} pt)`)
    lines.push(`In 24 h ${renders.last24h}× neu gezeichnet`)
    if (renders.medianGapMinutes !== null && renders.maxGapMinutes !== null) {
      lines.push(`Abstand typisch ${formatMinutes(renders.medianGapMinutes)}, längste Pause ${formatMinutes(renders.maxGapMinutes)}`)
    }
  }
  await Dialog.alert({ title: "Status", message: lines.join("\n") })
}

function sourceLine(state: SourceState, now: number): string {
  if (state.lastSuccess === null) return state.lastAttemptOk === false ? "bisher nur Fehlversuche" : "noch nie abgerufen"
  const failedSince = state.lastAttemptOk === false && state.lastAttempt !== null
  return `zuletzt ${formatRelativeDay(state.lastSuccess, now)}${failedSince ? ", letzter Versuch fehlgeschlagen" : ""}`
}
