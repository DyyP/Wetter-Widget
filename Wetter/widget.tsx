/**
 * Widget-Einstieg. In Meilenstein 1 ein Diagnose-Widget ohne Wetterabruf:
 * Es protokolliert jeden Durchlauf, damit wir messen, wie oft iOS es neu zeichnet.
 */

import { Script, Text, Widget } from "scripting"
import type { ProbeSummary } from "./core/diagnostics"
import { formatRenderEntry, parseRenderLog, probeLine, summarizeRenders, trimRenderLog } from "./core/diagnostics"
import { formatClock, formatMinutes } from "./core/format"
import { widgetLocationAllowed } from "./platform/location"
import { readSecret } from "./platform/secrets"
import { appendText, readJson, readText, sharedFiles, writeText } from "./platform/storage"
import { DiagnosticsWidget } from "./ui/DiagnosticsWidget"

/** Wunsch an iOS: frühestens nach 15 Minuten erneut zeichnen. iOS entscheidet selbst. */
const REFRESH_MINUTES = 15
const MAX_LOG_ENTRIES = 500

async function main(): Promise<void> {
  const now = Date.now()
  const size = Widget.displaySize
  const entry = { time: now, family: Widget.family, width: size.width, height: size.height }

  // Protokoll zuerst schreiben: Nach Widget.present() läuft kein Code mehr.
  await appendText(sharedFiles.renderLog, formatRenderEntry(entry))
  const entries = parseRenderLog((await readText(sharedFiles.renderLog)) ?? "")
  if (entries.length > MAX_LOG_ENTRIES * 1.2) {
    await writeText(sharedFiles.renderLog, trimRenderLog(entries, MAX_LOG_ENTRIES))
  }
  const stats = summarizeRenders(entries, now)
  const probe = await readJson<ProbeSummary>(sharedFiles.lastProbe)

  const refreshParts = [`Gezeichnet ${formatClock(now)}`, `${stats.last24h}× in 24 h`]
  if (stats.medianGapMinutes !== null) refreshParts.push(`typisch alle ${formatMinutes(stats.medianGapMinutes)}`)

  Widget.present(
    <DiagnosticsWidget
      data={{
        version: Script.metadata?.version ?? "?",
        meteoblueKey: readSecret("meteoblue") !== null,
        sunsethueKey: readSecret("sunsethue") !== null,
        locationAllowed: widgetLocationAllowed(),
        probeLine: probeLine(probe, now),
        sizeLine: `${Widget.family} · ${Math.round(size.width)}×${Math.round(size.height)} pt`,
        refreshLine: refreshParts.join(" · "),
      }}
    />,
    { policy: "after", date: new Date(now + REFRESH_MINUTES * 60_000) },
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  Widget.present(
    <Text font={11} foregroundStyle="#ff6b6b" padding>
      {`Fehler: ${message}`}
    </Text>,
  )
})
