/**
 * API-Keys im iOS-Schlüsselbund. Der Schlüsselbund von Scripting ist pro
 * Script getrennt, App und Widget desselben Scripts teilen ihn.
 */

export type SecretName = "meteoblue" | "sunsethue"

const KEYCHAIN_KEYS: Record<SecretName, string> = {
  meteoblue: "apikey.meteoblue",
  sunsethue: "apikey.sunsethue",
}

// Nur auf diesem Gerät und schon nach dem ersten Entsperren lesbar:
// So kann das Widget den Key auch bei gesperrtem iPhone lesen.
const OPTIONS: Keychain.Options = {
  accessibility: "first_unlock_this_device",
  synchronizable: false,
}

export function readSecret(name: SecretName): string | null {
  try {
    const value = Keychain.get(KEYCHAIN_KEYS[name], OPTIONS)
    return value !== null && value.trim() !== "" ? value.trim() : null
  } catch {
    return null
  }
}

export function saveSecret(name: SecretName, value: string): boolean {
  const trimmed = value.trim()
  if (trimmed === "") return false
  return Keychain.set(KEYCHAIN_KEYS[name], trimmed, OPTIONS)
}

export function deleteSecret(name: SecretName): boolean {
  return Keychain.remove(KEYCHAIN_KEYS[name], OPTIONS)
}
