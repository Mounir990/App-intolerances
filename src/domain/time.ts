/** Utilitaires de date/heure locales (le journal raisonne en jours LOCAUX). */

const pad = (n: number) => String(n).padStart(2, '0')

/** Jour local d'un instant : « 2026-03-07 ». */
export function dateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Heure locale « HH:MM » (valeur d'un <input type="time">). */
export function timeKey(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Combine un jour « AAAA-MM-JJ » et une heure « HH:MM » en epoch ms locale. */
export function toTs(date: string, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime()
}

/** Nombre de jours entiers entre deux jours locaux (b - a), insensible à l'heure d'été. */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number)
  const [yb, mb, db] = b.split('-').map(Number)
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86_400_000)
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`
}

export const todayKey = () => dateKey(Date.now())
