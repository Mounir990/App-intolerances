import { useLiveQuery } from 'dexie-react-hooks'
import { db, type AppDB } from './db'
import { CATEGORY_IDS, type CategoryId } from '@/features/today/categories'
import type { DayRecord } from '@/domain/types'

/** Nombre d'entrées d'un jour, par catégorie de l'écran « Aujourd'hui ». */
export async function countsForDay(date: string, database: AppDB = db): Promise<Record<CategoryId, number>> {
  const n = (table: { where: (k: string) => { equals: (v: string) => { count: () => Promise<number> } } }) =>
    table.where('date').equals(date).count()
  const [meal, digestive, skinOrl, gyne, pain, cycle, context] = await Promise.all([
    n(database.meals), n(database.digestive), n(database.extra), n(database.gyne), n(database.pain), n(database.cycleStarts), n(database.context),
  ])
  return { meal, digestive, skinOrl, gyne: gyne + pain + cycle, context }
}

export const EMPTY_COUNTS = Object.fromEntries(CATEGORY_IDS.map((c) => [c, 0])) as Record<CategoryId, number>

export function useDayCounts(date: string): Record<CategoryId, number> {
  return useLiveQuery(() => countsForDay(date), [date], EMPTY_COUNTS)
}

/** « Journée terminée » : une journée terminée sera utilisée plus tard par les analyses (phase 2). */
export async function setDayCompleted(date: string, completed: boolean, database: AppDB = db): Promise<void> {
  const row: DayRecord = completed ? { date, completed: true, completedAt: Date.now() } : { date, completed: false }
  await database.days.put(row)
}

export function useDayRecord(date: string): DayRecord | undefined {
  return useLiveQuery(() => db.days.get(date), [date])
}

export function useCycleStarts() {
  return useLiveQuery(() => db.cycleStarts.toArray(), [], [])
}
