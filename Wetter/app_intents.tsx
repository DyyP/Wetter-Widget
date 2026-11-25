/**
 * AppIntents (laufen im Hintergrund, Script.env === "app_intents").
 * Antippen des Widgets: Ort und Datenstand prüfen, veraltete Daten im
 * Rahmen des Budgets neu holen und das Widget neu zeichnen.
 */

import { AppIntentManager, AppIntentProtocol, Widget } from "scripting"
import { refresh } from "./data/refresh"

export const RefreshIntent = AppIntentManager.register({
  name: "RefreshIntent",
  protocol: AppIntentProtocol.AppIntent,
  perform: async (_params: undefined) => {
    try {
      await refresh(Date.now(), "tap", "intent")
    } finally {
      Widget.reloadAll()
    }
  },
})
