/** Standort mit Kilometer-Genauigkeit: reicht für eine Punktvorhersage und spart Akku. */

import { roundCoordinates, type Coordinates } from "../core/geo"

/** Aktueller Ort, gerundet. null, wenn die Ortung scheitert oder länger als `timeoutMs` dauert. */
export async function currentCoordinates(timeoutMs: number): Promise<Coordinates | null> {
  const locate = async (): Promise<Coordinates | null> => {
    try {
      await Location.setAccuracy("kilometer")
      const location = await Location.requestCurrent()
      return location === null ? null : roundCoordinates({ lat: location.latitude, lon: location.longitude })
    } catch {
      return null
    }
  }
  let timer: number | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  try {
    return await Promise.race([locate(), timeout])
  } finally {
    clearTimeout(timer)
  }
}

/** Ob iOS dem Widget Standortabfragen erlaubt */
export function widgetLocationAllowed(): boolean {
  try {
    return Location.isAuthorizedForWidgetUpdates
  } catch {
    return false
  }
}
