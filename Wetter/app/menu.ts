/**
 * Hauptmenü in der App. Es erscheint einmal, nach der Aktion endet das Script.
 * Eine Schleife lässt sich in Scripting nicht zuverlässig schließen.
 */

import { Script, Widget } from "scripting"
import { manageKeys } from "./keys"
import { refreshNow } from "./refreshNow"
import { showStatus } from "./status"

export async function runMenu(): Promise<void> {
  const actions: { label: string; run: () => Promise<void> }[] = [
    { label: "Widget-Vorschau", run: () => Widget.preview({ family: "systemMedium" }) },
    { label: "Jetzt aktualisieren", run: refreshNow },
    { label: "Status anzeigen", run: showStatus },
    { label: "API-Keys einrichten", run: manageKeys },
  ]
  const choice = await Dialog.actionSheet({
    title: `Wetter-Widget ${Script.metadata?.version ?? ""}`.trim(),
    cancelButton: false,
    actions: [...actions.map(({ label }) => ({ label })), { label: "Schließen" }],
  })
  await (choice === null ? undefined : actions[choice]?.run())
}
