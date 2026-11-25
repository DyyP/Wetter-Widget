/**
 * Widget-Einstieg: Daten nach Plan auffrischen, aus dem Cache das Modell bauen,
 * fehlende Icons laden und zeichnen. Mit dem Widget-Parameter „diagnose“
 * zeigt das Widget stattdessen die Diagnose aus Meilenstein 1.
 */

import { Script, Widget } from "scripting"
import type { ProbeSummary } from "./core/diagnostics"
import { probeLine, summarizeRenders } from "./core/diagnostics"
import { formatClock, formatMinutes } from "./core/format"
import { buildModel, type WidgetModel } from "./core/model"
import { refresh } from "./data/refresh"
import { loadAlerts, loadForecast, loadSunEvents } from "./platform/cache"
import { ensureIcons, iconPath } from "./platform/icons"
import { widgetLocationAllowed } from "./platform/location"
import { recordRender } from "./platform/renderlog"
import { readSecret } from "./platform/secrets"
import { readJson, sharedFiles } from "./platform/storage"
import { DiagnosticsWidget } from "./ui/DiagnosticsWidget"
import { MessageWidget, WeatherWidget } from "./ui/WeatherWidget"

async function main(): Promise<void> {
  const now = Date.now()
  const size = Widget.displaySize
  // Protokoll zuerst: Nach Widget.present() läuft kein Code mehr.
  const renders = await recordRender({ time: now, family: Widget.family, width: size.width, height: size.height })

  if (Widget.parameter.trim().toLowerCase() === "diagnose") {
    await presentDiagnostics(now, renders)
    return
  }

  try {
    await refresh(now)
  } catch {
    // Abruffehler sind kein Grund, nichts zu zeigen: Der Cache reicht.
  }

  const [forecast, sunEvents, alerts] = await Promise.all([loadForecast(), loadSunEvents(), loadAlerts()])
  const result = buildModel({
    now,
    forecast: forecast?.value ?? null,
    fetchedAt: forecast?.fetchedAt ?? null,
    sunEvents: sunEvents?.value ?? [],
    alerts: alerts?.value ?? [],
  })

  if (!result.ok) {
    const keyMissing = readSecret("meteoblue") === null
    Widget.present(
      <MessageWidget
        title="Wetter-Widget"
        message={
          keyMissing
            ? "Noch kein meteoblue-Key. Öffne das Script „Wetter“ in Scripting und richte die Keys ein."
            : result.reason === "no-data"
              ? "Noch keine Wetterdaten. Prüfe Netz und Standortfreigabe, das Widget versucht es gleich erneut."
              : "Die gespeicherten Daten sind veraltet. Prüfe die Internetverbindung."
        }
      />,
      { policy: "after", date: new Date(now + 15 * 60_000) },
    )
    return
  }

  const available = await ensureIcons(iconNames(result.model))
  Widget.present(<WeatherWidget model={result.model} icons={{ available, path: iconPath }} />, {
    policy: "after",
    // Kurz nach der vollen Stunde, damit „JETZT“ weiterrückt
    date: new Date(result.model.nextRefresh + 60_000),
  })
}

function iconNames(model: WidgetModel): string[] {
  return [...model.slots.map((s) => s.icon), ...model.days.map((d) => d.icon)]
}

async function presentDiagnostics(now: number, renders: Awaited<ReturnType<typeof recordRender>>): Promise<void> {
  const stats = summarizeRenders(renders, now)
  const probe = await readJson<ProbeSummary>(sharedFiles.lastProbe)
  const refreshParts = [`Gezeichnet ${formatClock(now)}`, `${stats.last24h}× in 24 h`]
  if (stats.medianGapMinutes !== null) refreshParts.push(`typisch alle ${formatMinutes(stats.medianGapMinutes)}`)
  const size = Widget.displaySize
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
    { policy: "after", date: new Date(now + 15 * 60_000) },
  )
}

main().catch((error: unknown) => {
  Widget.present(
    <MessageWidget title="Wetter-Widget: Fehler" message={error instanceof Error ? error.message : String(error)} />,
  )
})
