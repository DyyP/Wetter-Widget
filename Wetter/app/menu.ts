/** Hauptmenü, wenn das Script in der App gestartet wird. */

import { Script, Widget } from "scripting"
import { manageKeys } from "./keys"
import { runProbe } from "./probe"
import { showStatus } from "./status"

export async function runMenu(): Promise<void> {
  const version = Script.metadata?.version ?? "?"
  for (;;) {
    const choice = await Dialog.actionSheet({
      title: `Wetter-Widget ${version}`,
      message: "Meilenstein 1: Einrichtung und Test-Abruf",
      actions: [
        { label: "Status anzeigen" },
        { label: "API-Keys einrichten" },
        { label: "Test-Abruf (8.000 Credits)" },
        { label: "Widget neu zeichnen" },
      ],
    })
    if (choice === null) return
    if (choice === 0) await showStatus()
    else if (choice === 1) await manageKeys()
    else if (choice === 2) await runProbe()
    else if (choice === 3) {
      Widget.reloadAll()
      await Dialog.alert({ title: "Angefordert", message: "iOS zeichnet das Widget in Kürze neu." })
    }
  }
}
