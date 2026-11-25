/** Einrichtung der API-Keys über Dialoge. Keys landen nur im Schlüsselbund. */

import { maskSecret } from "../core/format"
import type { SecretName } from "../platform/secrets"
import { deleteSecret, readSecret, saveSecret } from "../platform/secrets"

const LABELS: Record<SecretName, string> = {
  meteoblue: "meteoblue",
  sunsethue: "Sunsethue",
}

const HINTS: Record<SecretName, string> = {
  meteoblue: "Zu finden auf my.meteoblue.com unter Account → Weather API → API Keys.",
  sunsethue: "Zu finden auf sunsethue.com/dev-api/portal.",
}

export async function manageKeys(): Promise<void> {
  const choice = await Dialog.actionSheet({
    title: "API-Keys",
    message: `meteoblue: ${maskSecret(readSecret("meteoblue"))}\nSunsethue: ${maskSecret(readSecret("sunsethue"))}`,
    actions: [
      { label: "meteoblue-Key eingeben" },
      { label: "Sunsethue-Key eingeben" },
      { label: "Alle Keys löschen", destructive: true },
    ],
  })
  if (choice === 0) await enterKey("meteoblue")
  else if (choice === 1) await enterKey("sunsethue")
  else if (choice === 2) await deleteAllKeys()
}

async function enterKey(name: SecretName): Promise<void> {
  const value = await Dialog.prompt({
    title: `${LABELS[name]}-Key`,
    message: `${HINTS[name]}\nDer Key wird nur im Schlüsselbund dieses iPhones gespeichert.`,
    placeholder: "Key einfügen",
    obscureText: true,
    confirmLabel: "Speichern",
    cancelLabel: "Abbrechen",
  })
  if (value === null) return
  if (value.trim() === "") {
    await Dialog.alert({ title: "Nicht gespeichert", message: "Der Key war leer." })
    return
  }
  const saved = saveSecret(name, value)
  await Dialog.alert({
    title: saved ? "Gespeichert" : "Fehler",
    message: saved
      ? `${LABELS[name]}-Key ${maskSecret(value)} ist im Schlüsselbund.`
      : "Der Schlüsselbund hat das Speichern abgelehnt. Bitte noch einmal versuchen.",
  })
}

async function deleteAllKeys(): Promise<void> {
  const confirmed = await Dialog.confirm({
    title: "Keys löschen?",
    message: "Danach kann das Widget keine Daten mehr abrufen, bis du die Keys neu eingibst.",
    confirmLabel: "Löschen",
    cancelLabel: "Abbrechen",
  })
  if (!confirmed) return
  deleteSecret("meteoblue")
  deleteSecret("sunsethue")
  await Dialog.alert({ title: "Gelöscht", message: "Beide Keys wurden entfernt." })
}
