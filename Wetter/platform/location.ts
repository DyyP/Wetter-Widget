/** Aktueller Standort mit Kilometer-Genauigkeit: reicht für eine Punktvorhersage und spart Akku. */

export interface Coordinates {
  lat: number
  lon: number
}

export async function currentCoordinates(): Promise<Coordinates | null> {
  try {
    await Location.setAccuracy("kilometer")
    const location = await Location.requestCurrent()
    return location === null ? null : { lat: location.latitude, lon: location.longitude }
  } catch {
    return null
  }
}

/** Ob iOS dem Widget Standortabfragen erlaubt. */
export function widgetLocationAllowed(): boolean | null {
  try {
    return Location.isAuthorizedForWidgetUpdates
  } catch {
    return null
  }
}
