/** Hauptmenü, wenn das Script in der App gestartet wird. */

import { Script, Widget } from "scripting"
import { manageKeys } from "./keys"
import { runProbe } from "./probe"
import { refreshNow } from "./refreshNow"
import { showStatus } from "./status"

export async function runMenu(): Promise<void> {
  const version = Script.metadata?.version ?? "?"
  for (;;) {
    const choice = await Dialog.actionSheet({
      title: `Wetter-Widget ${version}`,
      actions: [
        { label: "Widget-Vorschau" },
        { label: "Jetzt aktualisieren (8.000 Credits)" },
        { label: "Status anzeigen" },
        { label: "API-Keys einrichten" },
        { label: "Rohantwort speichern (Diagnose, 8.000 Credits)" },
      ],
    })
    if (choice === null) return
    if (choice === 0) await Widget.preview({ family: "systemMedium" })
    else if (choice === 1) await refreshNow()
    else if (choice === 2) await showStatus()
    else if (choice === 3) await manageKeys()
    else if (choice === 4) await runProbe()
  }
}
