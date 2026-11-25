/** App-Einstieg: startet das Menü für Einrichtung und Diagnose. */

import { Script } from "scripting"
import { runMenu } from "./app/menu"

async function main(): Promise<void> {
  try {
    await runMenu()
  } catch (error) {
    await Dialog.alert({ title: "Unerwarteter Fehler", message: error instanceof Error ? error.message : String(error) })
  } finally {
    Script.exit()
  }
}

void main()
