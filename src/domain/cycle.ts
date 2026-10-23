import { addDays, daysBetween } from './time'

/**
 * Jour du cycle et phase ESTIMÉE à partir des dates de début des règles (jour 1).
 * Ce sont des estimations (aucun diagnostic) : l'ovulation est supposée 14 jours avant
 * les règles suivantes, ce qui est une moyenne et non une mesure.
 *
 * Jours (cycle de L jours, règles de P jours) :
 *   menstruation  : 1 … P
 *   folliculaire  : P+1 … ovulation-2
 *   ovulation     : jour (L-14) ± 1
 *   lutéale       : ovulation+2 … prémenstruelle-1
 *   prémenstruelle: les 5 derniers jours (L-4 … L), et au-delà si les règles sont en retard
 */

export type CyclePhase = 'menstruation' | 'follicular' | 'ovulation' | 'luteal' | 'premenstrual'

export interface CycleSettings { cycleLength: number; periodLength: number }

/** Début de règles enregistré ; `cycleLength` = durée imposée à la main pour CE cycle. */
export interface CycleStartLike { date: string; cycleLength?: number }

/** Durées de cycle jugées plausibles pour la moyenne (un écart plus grand = règle oubliée ou doublon). */
export const PLAUSIBLE_CYCLE = { min: 15, max: 60 }
/** Au-delà de ce nombre de jours sans nouveau début de règles, on n'affiche plus de phase. */
export const STALE_AFTER_DAYS = 90
/** Écart max-min (jours) au-delà duquel on parle de cycles irréguliers. */
export const IRREGULAR_RANGE_DAYS = 7

export interface CycleStats {
  /** Durée moyenne des derniers cycles (jours, arrondie), sinon la valeur par défaut. */
  mean: number
  min: number | null
  max: number | null
  /** Nombre de cycles mesurés utilisés. */
  count: number
  lengths: number[]
  irregular: boolean
  source: 'observed' | 'default'
}

/** Moyenne des `maxCycles` derniers cycles plausibles (gère les cycles irréguliers). */
export function cycleStats(startDates: string[], fallbackLength: number, maxCycles = 6): CycleStats {
  const sorted = [...new Set(startDates)].sort()
  const all: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const len = daysBetween(sorted[i - 1], sorted[i])
    if (len >= PLAUSIBLE_CYCLE.min && len <= PLAUSIBLE_CYCLE.max) all.push(len)
  }
  const lengths = all.slice(-maxCycles)
  if (lengths.length === 0) {
    return { mean: fallbackLength, min: null, max: null, count: 0, lengths: [], irregular: false, source: 'default' }
  }
  const mean = Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length)
  const min = Math.min(...lengths)
  const max = Math.max(...lengths)
  return { mean, min, max, count: lengths.length, lengths, irregular: lengths.length >= 2 && max - min > IRREGULAR_RANGE_DAYS, source: 'observed' }
}

/** Phase d'un jour de cycle pour un cycle de `length` jours et des règles de `period` jours. */
export function phaseForDay(day: number, length: number, period: number): CyclePhase {
  const ovulationDay = Math.max(length - 14, period + 2)
  const menstruationEnd = Math.min(period, ovulationDay - 2)
  const premenstrualStart = Math.max(length - 4, ovulationDay + 2)
  if (day <= menstruationEnd) return 'menstruation'
  if (day < ovulationDay - 1) return 'follicular'
  if (day <= ovulationDay + 1) return 'ovulation'
  if (day < premenstrualStart) return 'luteal'
  return 'premenstrual'
}

export interface CycleInfo {
  date: string
  /** Date du jour 1 du cycle auquel appartient `date`. */
  cycleStart: string
  /** Jour du cycle (1 = premier jour des règles). */
  cycleDay: number
  phase: CyclePhase
  /** Durée de cycle utilisée pour estimer la phase. */
  expectedLength: number
  lengthSource: 'manual' | 'observed' | 'average' | 'default'
  /** Le jour dépasse la durée attendue : règles probablement en retard. */
  overdue: boolean
  /** Les derniers cycles sont irréguliers : la phase est d'autant plus approximative. */
  irregular: boolean
}

/**
 * Infos de cycle pour un jour donné, ou null s'il n'y a pas de début de règles connu
 * avant ce jour (ou s'il date de plus de STALE_AFTER_DAYS).
 */
export function cycleInfo(date: string, starts: CycleStartLike[], settings: CycleSettings): CycleInfo | null {
  const sorted = [...starts].sort((a, b) => a.date.localeCompare(b.date))
  let idx = -1
  for (let i = 0; i < sorted.length; i++) if (sorted[i].date <= date) idx = i
  if (idx < 0) return null

  const start = sorted[idx]
  const cycleDay = daysBetween(start.date, date) + 1
  if (cycleDay > STALE_AFTER_DAYS) return null

  const next = sorted[idx + 1]
  // Statistiques calculées sur les cycles terminés AVANT ce début (pas d'information « du futur »).
  const stats = cycleStats(sorted.slice(0, idx + 1).map((s) => s.date), settings.cycleLength)
  let expectedLength: number
  let lengthSource: CycleInfo['lengthSource']
  if (start.cycleLength) { expectedLength = start.cycleLength; lengthSource = 'manual' }
  else if (next) { expectedLength = daysBetween(start.date, next.date); lengthSource = 'observed' }
  else if (stats.source === 'observed') { expectedLength = stats.mean; lengthSource = 'average' }
  else { expectedLength = settings.cycleLength; lengthSource = 'default' }

  return {
    date,
    cycleStart: start.date,
    cycleDay,
    phase: phaseForDay(cycleDay, expectedLength, settings.periodLength),
    expectedLength,
    lengthSource,
    overdue: !next && cycleDay > expectedLength,
    irregular: stats.irregular,
  }
}

/** Date estimée des prochaines règles (null sans donnée). Utile pour l'affichage « J-x ». */
export function nextPeriodEstimate(starts: CycleStartLike[], settings: CycleSettings): string | null {
  if (starts.length === 0) return null
  const sorted = [...starts].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const stats = cycleStats(sorted.map((s) => s.date), settings.cycleLength)
  return addDays(last.date, last.cycleLength ?? stats.mean)
}
