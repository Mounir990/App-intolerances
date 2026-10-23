import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type AppDB } from './db'
import { dateKey } from '@/domain/time'
import type { CategoryId } from '@/features/today/categories'

/** Tables du journal de symptômes et de contexte (une entrée = une ligne horodatée). */
export type EntryTable = 'digestive' | 'extra' | 'gyne' | 'pain' | 'context' | 'cycleStarts'

/** Catégorie de l'écran « Aujourd'hui » à laquelle appartient une table. */
export const CATEGORY_OF_TABLE: Record<EntryTable, CategoryId> = {
  digestive: 'digestive', extra: 'skinOrl', gyne: 'gyne', pain: 'gyne', cycleStarts: 'gyne', context: 'context',
}

interface Stamped { id: string; ts: number; date: string; createdAt: number; updatedAt: number }
export type AnyEntry = Stamped & Record<string, unknown>
export interface DayEntry { table: EntryTable; entry: AnyEntry }

/**
 * Crée ou met à jour une entrée. `ts` est l'instant précis de l'événement ; le jour local en est déduit.
 * (Les champs propres à chaque table sont libres : voir domain/types.ts.)
 */
export async function saveEntry(
  table: EntryTable, fields: Record<string, unknown> & { ts: number }, id?: string, database: AppDB = db,
): Promise<string> {
  const t = database.table(table)
  const now = Date.now()
  const base = { ...fields, date: dateKey(fields.ts) }
  if (id) {
    const existing = await t.get(id)
    if (!existing) throw new Error('Entrée introuvable')
    await t.put({ ...existing, ...base, id, updatedAt: now })
    return id
  }
  const newKey = newId()
  await t.add({ ...base, id: newKey, createdAt: now, updatedAt: now })
  return newKey
}

export const deleteEntry = (table: EntryTable, id: string, database: AppDB = db) => database.table(table).delete(id)
export const getEntry = (table: EntryTable, id: string, database: AppDB = db) => database.table(table).get(id) as Promise<AnyEntry | undefined>

/** Toutes les entrées d'un jour (symptômes, douleurs, début de règles, contexte), de la plus ancienne à la plus récente. */
export async function entriesOfDay(date: string, database: AppDB = db): Promise<DayEntry[]> {
  const tables = Object.keys(CATEGORY_OF_TABLE) as EntryTable[]
  const lists = await Promise.all(tables.map(async (table) => ({
    table, rows: (await database.table(table).where('date').equals(date).toArray()) as AnyEntry[],
  })))
  return lists.flatMap(({ table, rows }) => rows.map((entry) => ({ table, entry }))).sort((a, b) => a.entry.ts - b.entry.ts)
}

export function useEntriesOfDay(date: string): DayEntry[] {
  return useLiveQuery(() => entriesOfDay(date), [date], [])
}

export function useEntry(table: EntryTable, id: string | undefined): AnyEntry | undefined {
  return useLiveQuery(async () => (id ? getEntry(table, id) : undefined), [table, id])
}

/** Médicaments et compléments déjà notés, les plus fréquents d'abord (pour les reproposer en un tap). */
export async function usualMedications(database: AppDB = db): Promise<string[]> {
  const rows = (await database.context.where('kind').equals('medication').toArray())
  const count = new Map<string, number>()
  for (const r of rows) if (r.medName) count.set(r.medName, (count.get(r.medName) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name)
}
export function useUsualMedications(): string[] {
  return useLiveQuery(() => usualMedications(), [], [])
}
