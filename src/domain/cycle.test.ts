import { describe, expect, it } from 'vitest'
import { cycleInfo, cycleStats, nextPeriodEstimate, phaseForDay, STALE_AFTER_DAYS } from './cycle'
import { addDays } from './time'

const S = { cycleLength: 28, periodLength: 5 }
const start = (date: string, cycleLength?: number) => ({ date, cycleLength })

describe('phaseForDay — cycle de 28 jours, règles de 5 jours', () => {
  const phases = (days: number[]) => days.map((d) => phaseForDay(d, 28, 5))
  it('menstruation jours 1 à 5', () => expect(new Set(phases([1, 2, 3, 4, 5]))).toEqual(new Set(['menstruation'])))
  it('folliculaire jours 6 à 12', () => expect(new Set(phases([6, 9, 12]))).toEqual(new Set(['follicular'])))
  it('ovulation jours 13 à 15 (jour 14 ± 1)', () => expect(new Set(phases([13, 14, 15]))).toEqual(new Set(['ovulation'])))
  it('lutéale jours 16 à 23', () => expect(new Set(phases([16, 20, 23]))).toEqual(new Set(['luteal'])))
  it('prémenstruelle jours 24 à 28 et au-delà', () => expect(new Set(phases([24, 26, 28, 31]))).toEqual(new Set(['premenstrual'])))
  it('un cycle court (21 j) garde l\'ordre des phases sans chevauchement', () => {
    const order = ['menstruation', 'follicular', 'ovulation', 'luteal', 'premenstrual']
    let last = 0
    for (let d = 1; d <= 21; d++) {
      const i = order.indexOf(phaseForDay(d, 21, 5))
      expect(i).toBeGreaterThanOrEqual(last)
      last = i
    }
  })
})

describe('cycleInfo — jour du cycle', () => {
  const starts = [start('2026-03-01')]
  it('le jour de début est le jour 1', () => {
    expect(cycleInfo('2026-03-01', starts, S)).toMatchObject({ cycleDay: 1, phase: 'menstruation', cycleStart: '2026-03-01' })
  })
  it('compte les jours à partir de la date de début', () => {
    expect(cycleInfo('2026-03-05', starts, S)?.cycleDay).toBe(5)
    expect(cycleInfo('2026-03-14', starts, S)).toMatchObject({ cycleDay: 14, phase: 'ovulation' })
    expect(cycleInfo('2026-03-28', starts, S)).toMatchObject({ cycleDay: 28, phase: 'premenstrual', overdue: false })
  })
  it('traverse changement de mois, d\'année et d\'heure d\'été sans décalage', () => {
    expect(cycleInfo('2026-01-03', [start('2025-12-28')], S)?.cycleDay).toBe(7)
    expect(cycleInfo('2026-04-02', [start('2026-03-25')], S)?.cycleDay).toBe(9) // passage à l'heure d'été (fin mars)
    expect(cycleInfo('2026-11-03', [start('2026-10-20')], S)?.cycleDay).toBe(15) // retour à l'heure d'hiver
  })
  it('dit que les règles sont peut-être en retard au-delà de la durée attendue', () => {
    expect(cycleInfo('2026-03-31', starts, S)).toMatchObject({ cycleDay: 31, overdue: true, phase: 'premenstrual' })
  })
  it('renvoie null avant le premier début de règles et sans aucune donnée', () => {
    expect(cycleInfo('2026-02-28', starts, S)).toBeNull()
    expect(cycleInfo('2026-03-10', [], S)).toBeNull()
  })
  it('renvoie null si le dernier début est trop ancien (donnée probablement manquante)', () => {
    expect(cycleInfo(addDays('2026-03-01', STALE_AFTER_DAYS - 1), starts, S)).not.toBeNull() // jour 90
    expect(cycleInfo(addDays('2026-03-01', STALE_AFTER_DAYS), starts, S)).toBeNull() // jour 91
  })
  it('utilise le cycle auquel appartient le jour, pas seulement le dernier', () => {
    const two = [start('2026-01-01'), start('2026-01-29')]
    expect(cycleInfo('2026-01-20', two, S)).toMatchObject({ cycleStart: '2026-01-01', cycleDay: 20 })
    expect(cycleInfo('2026-01-30', two, S)).toMatchObject({ cycleStart: '2026-01-29', cycleDay: 2 })
  })
})

describe('cycleStats — durée moyenne et cycles irréguliers', () => {
  it('sans historique : durée par défaut', () => {
    expect(cycleStats(['2026-01-01'], 28)).toMatchObject({ mean: 28, source: 'default', count: 0, irregular: false })
  })
  it('moyenne des cycles mesurés', () => {
    const r = cycleStats(['2026-01-01', '2026-01-30', '2026-02-27', '2026-03-28'], 28) // 29, 28, 29
    expect(r).toMatchObject({ mean: 29, count: 3, min: 28, max: 29, irregular: false, source: 'observed' })
  })
  it('détecte des cycles irréguliers (écart > 7 jours) et moyenne quand même', () => {
    const r = cycleStats(['2026-01-01', '2026-01-26', '2026-03-02', '2026-03-28'], 28) // 25, 35, 26
    expect(r.lengths).toEqual([25, 35, 26])
    expect(r.mean).toBe(29)
    expect(r.irregular).toBe(true)
  })
  it('ignore les écarts impossibles (règle oubliée / doublon)', () => {
    const r = cycleStats(['2026-01-01', '2026-01-05', '2026-05-05', '2026-06-02'], 28) // 4 j, 120 j, 28 j
    expect(r.lengths).toEqual([28])
  })
  it('ne garde que les derniers cycles', () => {
    const starts = ['2025-01-01', '2025-02-10', '2025-03-12', '2025-04-09', '2025-05-07', '2025-06-04', '2025-07-02', '2025-07-30']
    const r = cycleStats(starts, 28, 3)
    expect(r.lengths).toEqual([28, 28, 28])
  })
})

describe('cycleInfo — durée de cycle utilisée', () => {
  it('cycle en cours : moyenne des cycles précédents', () => {
    const starts = [start('2026-01-01'), start('2026-01-31'), start('2026-03-02'), start('2026-04-01')] // 30, 30, 30
    expect(cycleInfo('2026-04-17', starts, S)).toMatchObject({ lengthSource: 'average', expectedLength: 30, cycleDay: 17, phase: 'ovulation' })
  })
  it('cycle terminé : durée observée (le suivant a commencé)', () => {
    const starts = [start('2026-01-01'), start('2026-02-05')] // 35 jours
    expect(cycleInfo('2026-01-21', starts, S)).toMatchObject({ lengthSource: 'observed', expectedLength: 35, cycleDay: 21, phase: 'ovulation' })
  })
  it('durée imposée à la main pour un cycle', () => {
    expect(cycleInfo('2026-03-10', [start('2026-03-01', 32)], S)).toMatchObject({ lengthSource: 'manual', expectedLength: 32 })
  })
  it('sans historique : durée par défaut des réglages', () => {
    expect(cycleInfo('2026-03-10', [start('2026-03-01')], { cycleLength: 31, periodLength: 5 })).toMatchObject({ lengthSource: 'default', expectedLength: 31 })
  })
  it('signale l\'irrégularité des derniers cycles', () => {
    const starts = [start('2026-01-01'), start('2026-01-26'), start('2026-03-02'), start('2026-03-28')]
    expect(cycleInfo('2026-04-02', starts, S)?.irregular).toBe(true)
  })
  it('estime les prochaines règles', () => {
    expect(nextPeriodEstimate([start('2026-03-01')], S)).toBe('2026-03-29')
    expect(nextPeriodEstimate([], S)).toBeNull()
  })
})
