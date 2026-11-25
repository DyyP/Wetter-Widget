/** „Jetzt aktualisieren“: alle Quellen sofort abrufen, Icons vorbereiten, Ergebnis zeigen. */

import { Widget } from "scripting"
import { formatThousands } from "../core/format"
import { BASIC_CALL_CREDITS } from "../core/meteoblue"
import type { MeteoblueDecision } from "../core/planner"
import { refresh, type Outcome, type RefreshReport } from "../data/refresh"
import { prepareIcons } from "../platform/icons"

export async function refreshNow(): Promise<void> {
  const confirmed = await Dialog.confirm({
    title: "Jetzt aktualisieren?",
    message: `Holt meteoblue, Sunsethue und die DWD-Warnungen sofort. Der meteoblue-Abruf kostet ${formatThousands(BASIC_CALL_CREDITS)} Credits.`,
    confirmLabel: "Aktualisieren",
    cancelLabel: "Abbrechen",
  })
  if (!confirmed) return
  const [{ report }, icons] = await Promise.all([refresh(Date.now(), "manual", "app"), prepareIcons()])
  Widget.reloadAll()
  await Dialog.alert({ title: "Aktualisiert", message: `${describe(report)}\nIcons: ${icons.ready} von ${icons.total}` })
}

function describe(report: RefreshReport): string {
  if (report.location === null) return "Kein Standort. Bitte in den iOS-Einstellungen den Standort für Scripting erlauben."
  const mb = report.meteoblue
  const credits = mb.outcome === "ok" && mb.credits !== null ? `, ${formatThousands(mb.credits)} Credits` : ""
  const lines = [
    report.locationFromCache ? "Standort: letzter bekannter Ort" : "Standort: aktuell",
    `meteoblue: ${outcome(mb.outcome, mb.error)}${credits}${skipReason(mb.decision)}`,
    `Sunsethue: ${outcome(report.sunsethue.outcome, report.sunsethue.error)}`,
    `DWD-Warnungen: ${outcome(report.warnings.outcome, report.warnings.error)}`,
  ]
  return lines.join("\n")
}

function outcome(value: Outcome, error: string | null): string {
  switch (value) {
    case "ok":
      return "ok"
    case "skipped":
      return "nicht nötig"
    case "no-key":
      return "kein Key"
    case "failed":
      return `fehlgeschlagen (${error ?? "unbekannt"})`
  }
}

function skipReason(decision: MeteoblueDecision | null): string {
  if (decision === null || decision.fetch) return ""
  if (decision.reason === "daily-max") return " (Tageslimit erreicht)"
  if (decision.reason === "budget") return " (7-Tage-Budget erreicht)"
  return ""
}
