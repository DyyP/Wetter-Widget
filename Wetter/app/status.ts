/** Status in der App: Keys, Abrufe mit letztem Fehler, Budget und der letzte Widget-Durchlauf. */

import { formatRelativeDay, maskSecret } from "../core/format"
import { METEOBLUE_PLAN, meteoblueKeyRejected, type SourceState } from "../core/planner"
import { loadPlanner, loadWidgetRun } from "../platform/cache"
import { readSecret } from "../platform/secrets"

export async function showStatus(): Promise<void> {
  const now = Date.now()
  const [store, run] = await Promise.all([loadPlanner(), loadWidgetRun()])
  const weekCalls = store.meteoblue.billedCalls.filter((t) => t > now - 7 * 86_400_000).length

  const lines = [
    `meteoblue-Key: ${maskSecret(readSecret("meteoblue"))}`,
    `Sunsethue-Key: ${maskSecret(readSecret("sunsethue"))}`,
    "",
    `meteoblue: ${sourceLine(store.meteoblue, now)}`,
    ...(meteoblueKeyRejected(store.meteoblue)
      ? ["→ Key ungültig, abgelaufen oder ohne Credits. Der kostenlose Zugang gilt ein Jahr ab Aktivierung."]
      : []),
    `Abrufe in 7 Tagen: ${weekCalls} von ${METEOBLUE_PLAN.weeklyBudget}`,
    `Sunsethue: ${sourceLine(store.sunsethue, now)}`,
    `DWD-Warnungen: ${sourceLine(store.warnings, now)}`,
    "",
    run === null ? "Widget: noch kein Durchlauf" : `Widget ${formatRelativeDay(run.time, now)}: ${run.result}`,
    ...(run?.error == null ? [] : [`Abruf abgebrochen: ${run.error}`]),
  ]
  await Dialog.alert({ title: "Status", message: lines.join("\n") })
}

function sourceLine(state: SourceState, now: number): string {
  const success = state.lastSuccess === null ? "noch nie abgerufen" : `zuletzt ${formatRelativeDay(state.lastSuccess, now)}`
  if (state.lastError === null || state.lastAttempt === null) return success
  return `${success}, Versuch ${formatRelativeDay(state.lastAttempt, now)} fehlgeschlagen: ${state.lastError}`
}
