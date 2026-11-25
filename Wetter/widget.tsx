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
import { refresh, withTimeout } from "./data/refresh"
import { loadAlerts, loadForecast, loadSunEvents } from "./platform/cache"
import { ensureIcons, iconPath } from "./platform/icons"
import { widgetLocationAllowed } from "./platform/location"
import { recordRender } from "./platform/renderlog"
import { readSecret } from "./platform/secrets"
import { readJson, sharedFiles, writeJson } from "./platform/storage"
import { DiagnosticsWidget } from "./ui/DiagnosticsWidget"
import { MessageWidget, WeatherWidget } from "./ui/WeatherWidget"

/** Protokoll des letzten Widget-Durchlaufs, sichtbar unter „Status“ in der App */
const trace: { time: number; step: string }[] = []
function step(name: string): Promise<void> {
  trace.push({ time: Date.now(), step: name })
  return writeJson(sharedFiles.widgetTrace, { steps: trace }).catch(() => undefined)
}

/** iOS gibt Widgets nur wenige Sekunden. Abrufe bekommen höchstens so lange. */
const REFRESH_BUDGET_MS = 8000
const ICON_BUDGET_MS = 4000

async function main(): Promise<void> {
  const now = Date.now()
  await step("start")
  const size = Widget.displaySize
  // Protokoll zuerst: Nach Widget.present() läuft kein Code mehr.
  const renders = await recordRender({ time: now, family: Widget.family, width: size.width, height: size.height })

  if (Widget.parameter.trim().toLowerCase() === "diagnose") {
    await presentDiagnostics(now, renders)
    return
  }

  await step("refresh")
  try {
    const report = await withTimeout(refresh(now, { inWidget: true }), REFRESH_BUDGET_MS)
    await step(report === null ? "refresh: Zeitlimit" : "refresh: fertig")
  } catch (error) {
    // Abruffehler sind kein Grund, nichts zu zeigen: Der Cache reicht.
    await step(`refresh: Fehler ${error instanceof Error ? error.message : String(error)}`)
  }

  const [forecast, sunEvents, alerts] = await Promise.all([loadForecast(), loadSunEvents(), loadAlerts()])
  const result = buildModel({
    now,
    forecast: forecast?.value ?? null,
    fetchedAt: forecast?.fetchedAt ?? null,
    sunEvents: sunEvents?.value ?? [],
    alerts: alerts?.value ?? [],
  })

  await step(`modell: ${result.ok ? "ok" : result.reason}`)
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

  await step("icons")
  // Testparameter: "png" = meteoblue-PNGs statt SVG, "ohne-icons" = gar keine Icons
  const parameter = Widget.parameter.trim().toLowerCase()
  const mode = parameter === "png" ? "png" : parameter === "ohne-icons" ? "none" : "svg"
  const names = iconNames(result.model).map((n) => (mode === "png" ? n.replace(/\.svg$/, ".png") : n))
  const available =
    mode === "none" ? new Set<string>() : ((await withTimeout(ensureIcons(names), ICON_BUDGET_MS)) ?? new Set<string>())
  await step(`zeichnen (${mode}, ${available.size} Icons)`)
  const model =
    mode === "png"
      ? {
          ...result.model,
          slots: result.model.slots.map((sl) => ({ ...sl, icon: sl.icon.replace(/\.svg$/, ".png") })),
          days: result.model.days.map((d) => ({ ...d, icon: d.icon.replace(/\.svg$/, ".png") })),
        }
      : result.model
  Widget.present(<WeatherWidget model={model} icons={{ available, path: iconPath, mode }} />, {
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
