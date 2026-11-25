/**
 * Test-Abruf für Meilenstein 1: ein echter meteoblue-Abruf am aktuellen Ort.
 * Er zeigt, ob der Key funktioniert, was der Abruf wirklich kostet, und
 * speichert die Antwort als Datei, damit wir mit echten Daten entwickeln.
 */

import type { ProbeSummary } from "../core/diagnostics"
import { formatThousands } from "../core/format"
import {
  BASIC_CALL_CREDITS,
  MeteoblueError,
  buildBasicForecastUrl,
  errorFromResponse,
  parseBasicForecast,
  readCreditHeaders,
  redactApiKey,
} from "../core/meteoblue"
import { getJson } from "../platform/http"
import { currentCoordinates } from "../platform/location"
import { readSecret } from "../platform/secrets"
import { exportDirectory, sharedFiles, writeJson } from "../platform/storage"

export async function runProbe(): Promise<void> {
  const apiKey = readSecret("meteoblue")
  if (apiKey === null) {
    await Dialog.alert({ title: "Kein meteoblue-Key", message: "Bitte zuerst unter „API-Keys“ den Key eingeben." })
    return
  }

  const confirmed = await Dialog.confirm({
    title: "Test-Abruf starten?",
    message: `Ein Abruf kostet laut meteoblue ${formatThousands(BASIC_CALL_CREDITS)} Credits. Dafür wird einmal dein Standort abgefragt.`,
    confirmLabel: "Abrufen",
    cancelLabel: "Abbrechen",
  })
  if (!confirmed) return

  const coordinates = await currentCoordinates()
  if (coordinates === null) {
    await Dialog.alert({
      title: "Kein Standort",
      message: "Scripting hat keinen Standort bekommen. Bitte in den iOS-Einstellungen den Standortzugriff für Scripting erlauben.",
    })
    return
  }

  const url = buildBasicForecastUrl(apiKey, coordinates)
  const started = Date.now()
  let summary: ProbeSummary

  try {
    const result = await getJson(url, { timeoutSeconds: 20, label: "meteoblue Test-Abruf" })
    const credits = readCreditHeaders(result.headers)
    const fileName = `meteoblue-test-${fileStamp(started)}.probe.json`
    const filePath = `${exportDirectory()}/${fileName}`

    // Die komplette Antwort samt Headern speichern, ohne API-Key.
    await writeJson(filePath, {
      hinweis: "Antwort des Test-Abrufs. Enthält deinen Standort auf etwa 100 m gerundet. Nicht öffentlich teilen.",
      zeit: new Date(started).toISOString(),
      url: redactApiKey(url),
      status: result.status,
      dauerMs: result.durationMs,
      creditHeader: credits.all,
      headers: Object.fromEntries(result.headers),
      body: result.body ?? result.text,
    })

    if (!result.ok) throw errorFromResponse(result.status, result.body)

    const forecast = parseBasicForecast(result.body)
    summary = {
      time: started,
      ok: true,
      status: result.status,
      credits: credits.accounted,
      hours: forecast.hourly.length,
      days: forecast.daily.length,
      modelRunUpdateUtc: forecast.modelRunUpdateUtc,
      durationMs: result.durationMs,
      error: null,
    }
    await writeJson(sharedFiles.lastProbe, summary)

    const creditText =
      credits.accounted === null
        ? "Die Antwort meldet keine Credits im Header (bitte im meteoblue-Konto nachsehen)."
        : `Abgerechnet: ${formatThousands(credits.accounted)} Credits.`
    const lines = [creditText, `${forecast.hourly.length} Stunden, ${forecast.daily.length} Tage, Dauer ${result.durationMs} ms.`]
    if (forecast.modelRunUpdateUtc !== null) lines.push(`Modelllauf fertig: ${forecast.modelRunUpdateUtc} UTC.`)
    lines.push(
      "",
      `Gespeichert als „${fileName}“ im Ordner Wetter-Widget (Dateien-App → iCloud Drive → Scripting). Schick mir die Datei gern im Chat.`,
    )
    await Dialog.alert({ title: "Abruf erfolgreich", message: lines.join("\n") })
  } catch (error) {
    const message = describeError(error)
    summary = {
      time: started,
      ok: false,
      status: error instanceof MeteoblueError ? error.status : null,
      credits: null,
      hours: 0,
      days: 0,
      modelRunUpdateUtc: null,
      durationMs: Date.now() - started,
      error: message,
    }
    await writeJson(sharedFiles.lastProbe, summary)
    await Dialog.alert({ title: "Abruf fehlgeschlagen", message })
  }
}

function describeError(error: unknown): string {
  if (error instanceof MeteoblueError) {
    switch (error.kind) {
      case "access":
        return `meteoblue lehnt den Key ab (${error.message}). Ist der Key abgelaufen oder sind die Credits aufgebraucht?`
      case "rate-limit":
        return `Zu viele Anfragen (${error.message}). Bitte später erneut versuchen.`
      case "server":
        return `Fehler bei meteoblue (${error.message}). Bitte später erneut versuchen.`
      case "request":
        return `meteoblue meldet eine fehlerhafte Anfrage: ${error.message}`
      case "format":
        return `Die Antwort hatte ein unerwartetes Format: ${error.message}`
    }
  }
  const text = error instanceof Error ? error.message : String(error)
  return `Netzwerkfehler: ${redactApiKey(text)}`
}

/** "20261125-0142" */
function fileStamp(time: number): string {
  const d = new Date(time)
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}
