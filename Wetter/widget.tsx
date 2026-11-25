/**
 * Widget-Einstieg: Daten nach Plan auffrischen, aus dem Cache das Modell
 * bauen und zeichnen. Das Ergebnis jedes Durchlaufs landet unter „Status“
 * in der App.
 */

import { Widget } from "scripting"
import { RefreshIntent } from "./app_intents"
import { buildModel, modelIconNames } from "./core/model"
import { refresh, reportErrors } from "./data/refresh"
import { loadAlerts, loadForecast, loadSunEvents, saveWidgetRun } from "./platform/cache"
import { renderedIcons } from "./platform/icons"
import { readSecret } from "./platform/secrets"
import { gridFor } from "./ui/theme"
import { MessageWidget, WeatherWidget } from "./ui/WeatherWidget"

/** Nach einem Hinweis statt Wetter: in 15 Minuten erneut versuchen */
const RETRY_MS = 15 * 60_000
/** Kurz nach der vollen Stunde neu zeichnen, damit „JETZT“ weiterrückt */
const AFTER_HOUR_MS = 60_000

async function main(): Promise<void> {
  const now = Date.now()
  if (Widget.family !== "systemMedium") {
    await showMessage(now, "Das Wetter-Widget gibt es nur in mittlerer Größe.", [])
    return
  }

  let errors: string[]
  try {
    errors = reportErrors(await refresh(now, "schedule", "widget"))
  } catch (error) {
    // Ohne frische Daten weiter mit dem Cache
    errors = [errorText(error)]
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
    const text =
      readSecret("meteoblue") === null
        ? "Noch kein meteoblue-Key. Öffne das Script „Wetter“ in Scripting und richte die Keys ein."
        : result.reason === "no-data"
          ? "Noch keine Wetterdaten. Öffne das Script „Wetter“ und tippe auf „Jetzt aktualisieren“."
          : "Die gespeicherten Daten sind veraltet. Prüfe die Internetverbindung."
    await showMessage(now, text, errors)
    return
  }

  const icons = await renderedIcons(modelIconNames(result.model))
  if (icons.size === 0) {
    await showMessage(now, "Die Wetter-Icons fehlen. Öffne das Script „Wetter“ und tippe auf „Jetzt aktualisieren“.", errors)
    return
  }

  await saveWidgetRun({ time: now, result: "Wetter", errors })
  Widget.present(
    <WeatherWidget
      model={result.model}
      icons={icons}
      grid={gridFor(Widget.displaySize.width)}
      tapIntent={RefreshIntent(undefined)}
    />,
    { policy: "after", date: new Date(result.model.nextRefresh + AFTER_HOUR_MS) },
  )
}

async function showMessage(now: number, text: string, errors: string[]): Promise<void> {
  await saveWidgetRun({ time: now, result: text, errors })
  Widget.present(<MessageWidget title="Wetter-Widget" message={text} />, { policy: "after", date: new Date(now + RETRY_MS) })
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

main().catch((error: unknown) => {
  Widget.present(<MessageWidget title="Wetter-Widget: Fehler" message={errorText(error)} />, {
    policy: "after",
    date: new Date(Date.now() + RETRY_MS),
  })
})
