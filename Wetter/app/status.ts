/** Status in der App: Keys, Abrufe, Budget und der letzte Widget-Durchlauf. */

import { formatRelativeDay, maskSecret } from "../core/format"
import { METEOBLUE_PLAN, type SourceState } from "../core/planner"
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
    `Abrufe in 7 Tagen: ${weekCalls} von ${METEOBLUE_PLAN.weeklyBudget}`,
    `Sunsethue: ${sourceLine(store.sunsethue, now)}`,
    `DWD-Warnungen: ${sourceLine(store.warnings, now)}`,
    "",
    run === null ? "Widget: noch kein Durchlauf" : `Widget ${formatRelativeDay(run.time, now)}: ${run.result}`,
    ...(run?.errors ?? []),
  ]
  await Dialog.alert({ title: "Status", message: lines.join("\n") })
}

function sourceLine(state: SourceState, now: number): string {
  if (state.lastSuccess === null) return state.lastAttemptOk === false ? "bisher nur Fehlversuche" : "noch nie abgerufen"
  const failed = state.lastAttemptOk === false ? ", letzter Versuch fehlgeschlagen" : ""
  return `zuletzt ${formatRelativeDay(state.lastSuccess, now)}${failed}`
}
