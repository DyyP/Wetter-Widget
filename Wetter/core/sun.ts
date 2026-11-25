/**
 * Sonnenauf- und -untergang ohne Internet, nach dem Verfahren von SunCalc
 * (Vladimir Agafonkin, BSD-2) bzw. den Formeln von astronomy.stackexchange /
 * NOAA. Genauigkeit etwa eine Minute, für den Sonnen-Slot völlig ausreichend.
 */

const RAD = Math.PI / 180
const DAY_MS = 86_400_000
const J1970 = 2_440_588
const J2000 = 2_451_545
const J0 = 0.0009
/** Obliquität der Ekliptik */
const OBLIQUITY = RAD * 23.4397
/** Standard-Höhenwinkel für Auf-/Untergang (Refraktion + Sonnenradius) */
const HORIZON = RAD * -0.833

export interface SunTimes {
  /** UTC in ms, null wenn die Sonne an diesem Tag nicht aufgeht (Polarnacht) */
  sunrise: number | null
  /** UTC in ms, null wenn die Sonne an diesem Tag nicht untergeht (Polartag) */
  sunset: number | null
}

/**
 * Sonnenzeiten für einen Kalendertag am Ort.
 * @param date Kalendertag "YYYY-MM-DD" in Ortszeit
 */
export function sunTimes(date: string, lat: number, lon: number): SunTimes {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) throw new Error(`Ungültiges Datum: ${date}`)
  // Ungefährer Sonnenhöchststand des Tages am Ort als Bezugszeitpunkt
  const localNoonUtc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) - (lon / 15) * 3_600_000

  const lw = RAD * -lon
  const phi = RAD * lat
  const d = toJulian(localNoonUtc) - J2000
  const n = Math.round(d - J0 - lw / (2 * Math.PI))
  const ds = J0 + lw / (2 * Math.PI) + n
  const M = RAD * (357.5291 + 0.98560028 * ds)
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M))
  const L = M + C + RAD * 102.9372 + Math.PI
  const dec = Math.asin(Math.sin(OBLIQUITY) * Math.sin(L))
  const jNoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

  const cosH = (Math.sin(HORIZON) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  if (cosH > 1) return { sunrise: null, sunset: null } // Polarnacht
  if (cosH < -1) return { sunrise: null, sunset: null } // Polartag

  const w = Math.acos(cosH)
  const approx = J0 + (w + lw) / (2 * Math.PI) + n
  const jSet = J2000 + approx + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)
  const jRise = jNoon - (jSet - jNoon)
  return { sunrise: fromJulian(jRise), sunset: fromJulian(jSet) }
}

function toJulian(ms: number): number {
  return ms / DAY_MS - 0.5 + J1970
}

function fromJulian(j: number): number {
  return Math.round((j + 0.5 - J1970) * DAY_MS)
}
