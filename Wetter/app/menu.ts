/**
 * Hauptmenü, wenn das Script in der App gestartet wird.
 * Bewusst ohne Schleife: Das Menü erscheint einmal, nach der Aktion endet das
 * Script. (Eine Schleife hat sich auf dem iPhone nicht schließen lassen.)
 */

import { Script, Widget } from "scripting"
import { manageKeys } from "./keys"
import { runProbe } from "./probe"
import { refreshNow } from "./refreshNow"
import { showStatus } from "./status"

export async function runMenu(): Promise<void> {
  const version = Script.metadata?.version ?? "?"
  const choice = await Dialog.actionSheet({
    title: `Wetter-Widget ${version}`,
    message: "Nach der Aktion schließt sich das Script. Für eine weitere Aktion einfach neu starten.",
    cancelButton: false,
    actions: [
      { label: "Widget-Vorschau" },
      { label: "Jetzt aktualisieren (8.000 Credits)" },
      { label: "Status anzeigen" },
      { label: "API-Keys einrichten" },
      { label: "Rohantwort speichern (Diagnose, 8.000 Credits)" },
      { label: "Schließen" },
    ],
  })
  if (choice === 0) await Widget.preview({ family: "systemMedium" })
  else if (choice === 1) await refreshNow()
  else if (choice === 2) await showStatus()
  else if (choice === 3) await manageKeys()
  else if (choice === 4) await runProbe()
  // Alles andere (Schließen, Abbrechen, unerwartete Werte) beendet das Script.
}
