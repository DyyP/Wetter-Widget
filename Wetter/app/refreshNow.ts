/** „Jetzt aktualisieren“ im App-Menü: alle Quellen sofort abrufen und berichten. */

import { Widget } from "scripting"
import { formatThousands } from "../core/format"
import { refresh, type RefreshReport, type SourceOutcome } from "../data/refresh"
import { allIconNames, prepareIcons } from "../platform/icons"

export async function refreshNow(): Promise<void> {
  const confirmed = await Dialog.confirm({
    title: "Jetzt aktualisieren?",
    message: "Holt meteoblue, Sunsethue und die DWD-Warnungen sofort. Der meteoblue-Abruf kostet 8.000 Credits.",
    confirmLabel: "Aktualisieren",
    cancelLabel: "Abbrechen",
  })
  if (!confirmed) return
  const report = await refresh(Date.now(), { manual: true })
  const icons = await prepareIcons()
  Widget.reloadAll()
  await Dialog.alert({
    title: "Aktualisiert",
    message: `${describe(report)}\nIcons: ${icons} von ${allIconNames().length} bereit`,
  })
}

export function describe(report: RefreshReport): string {
  if (report.location === null) return "Kein Standort verfügbar. Bitte Standortzugriff für Scripting erlauben."
  const lines = [report.locationFromCache ? "Standort: letzter bekannter Ort" : "Standort: aktuell"]
  const mb = report.meteoblue
  const credits = mb.credits === null ? "" : `, ${formatThousands(mb.credits)} Credits`
  lines.push(`meteoblue: ${outcome(mb.outcome, mb.error)}${mb.outcome === "ok" ? credits : ""}`)
  if (mb.decision !== null && !mb.decision.fetch) lines.push(`  (${skipReason(mb.decision.reason)})`)
  lines.push(`Sunsethue: ${outcome(report.sunsethue.outcome, report.sunsethue.error)}`)
  lines.push(`DWD-Warnungen: ${outcome(report.warnings.outcome, report.warnings.error)}`)
  return lines.join("\n")
}

function outcome(value: SourceOutcome, error: string | null): string {
  switch (value) {
    case "ok":
      return "ok"
    case "skipped":
      return "nicht nötig"
    case "unavailable":
      return "kein Key oder Standort"
    case "failed":
      return `fehlgeschlagen (${error ?? "unbekannt"})`
  }
}

function skipReason(reason: string): string {
  switch (reason) {
    case "daily-max":
      return "Tageslimit erreicht"
    case "budget":
      return "7-Tage-Budget erreicht"
    case "retry-wait":
      return "wartet nach Fehler"
    default:
      return "Daten aktuell"
  }
}
