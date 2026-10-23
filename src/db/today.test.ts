import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { getSettings } from './settings'
import { countsForDay, setDayCompleted } from './today'

let n = 0
let db: AppDB
beforeEach(() => { db = new AppDB(`today-${++n}`) })
const stamp = (date: string, ts = 1) => ({ date, ts, createdAt: ts, updatedAt: ts })

describe('comptage des entrées du jour par catégorie', () => {
  it('compte chaque catégorie et ne mélange pas les jours', async () => {
    await db.meals.bulkAdd([{ id: 'm1', ...stamp('2026-03-01'), type: 'lunch', items: [] }, { id: 'm2', ...stamp('2026-03-01', 2), type: 'dinner', items: [] }, { id: 'm3', ...stamp('2026-03-02'), type: 'lunch', items: [] }])
    await db.digestive.add({ id: 'd1', ...stamp('2026-03-01'), kind: 'bloating' })
    await db.extra.add({ id: 'e1', ...stamp('2026-03-01'), group: 'skin', kind: 'hives', intensity: 2 })
    await db.context.add({ id: 'c1', ...stamp('2026-03-01'), kind: 'stress', stress: 3 })
    expect(await countsForDay('2026-03-01', db)).toEqual({ meal: 2, digestive: 1, skinOrl: 1, gyne: 0, context: 1 })
    expect(await countsForDay('2026-03-02', db)).toEqual({ meal: 1, digestive: 0, skinOrl: 0, gyne: 0, context: 0 })
    expect(await countsForDay('2026-03-03', db)).toEqual({ meal: 0, digestive: 0, skinOrl: 0, gyne: 0, context: 0 })
  })
  it('la catégorie gynécologie regroupe douleur pelvienne, événements et début des règles', async () => {
    await db.pain.add({ id: 'p1', ...stamp('2026-03-01'), painType: 'cramping', intensity: 5, zones: [] })
    await db.gyne.add({ id: 'g1', ...stamp('2026-03-01'), kind: 'bleeding', bleedingType: 'medium' })
    await db.cycleStarts.add({ id: 'c1', ...stamp('2026-03-01') })
    expect((await countsForDay('2026-03-01', db)).gyne).toBe(3)
  })
})

describe('« Journée terminée »', () => {
  it('marque une journée terminée avec l\'horodatage, puis la rouvre', async () => {
    await setDayCompleted('2026-03-01', true, db)
    expect(await db.days.get('2026-03-01')).toMatchObject({ date: '2026-03-01', completed: true })
    expect((await db.days.get('2026-03-01'))!.completedAt).toBeGreaterThan(0)
    await setDayCompleted('2026-03-01', false, db)
    expect(await db.days.get('2026-03-01')).toEqual({ date: '2026-03-01', completed: false })
  })
  it('ne concerne que le jour demandé', async () => {
    await setDayCompleted('2026-03-01', true, db)
    expect(await db.days.get('2026-03-02')).toBeUndefined()
    expect((await db.days.toArray()).filter((d) => d.completed)).toHaveLength(1)
  })
})

describe('réglages enregistrés par une version plus ancienne', () => {
  it('reçoivent le thème et les catégories par défaut sans perdre leurs valeurs', async () => {
    const { db: shared } = await import('./db')
    await shared.settings.put({ key: 'app', value: { lang: 'fr', cycleLength: 30, periodLength: 4, profile: { watchedFlags: ['gluten'] } } as never })
    const s = await getSettings()
    expect(s).toMatchObject({ lang: 'fr', cycleLength: 30, theme: 'auto', hiddenCategories: [] })
    expect(s.profile.watchedFlags).toEqual(['gluten'])
    await shared.settings.clear()
  })
})
