import { db, type AppDB } from './db'

/**
 * Sauvegarde JSON de TOUTES les données de l'utilisatrice : réglages, journal, recettes,
 * ses modifications de fiches (foodOverrides) et ses aliments perso (customFoods).
 * La base d'origine (seed) n'est pas exportée : elle se recharge depuis le CSV de l'app.
 */
const BACKUP_TABLES = [
  'settings', 'customFoods', 'foodOverrides', 'recipes', 'meals', 'cycleStarts',
  'pain', 'gyne', 'digestive', 'extra', 'context', 'days',
] as const

export interface BackupFile {
  app: 'diario-sintomas'
  formatVersion: 1
  exportedAt: number
  tables: Record<(typeof BACKUP_TABLES)[number], unknown[]>
}

export async function exportAllData(database: AppDB = db): Promise<BackupFile> {
  const tables = {} as BackupFile['tables']
  for (const t of BACKUP_TABLES) tables[t] = await database.table(t).toArray()
  return { app: 'diario-sintomas', formatVersion: 1, exportedAt: Date.now(), tables }
}

/** Remplace les données actuelles par celles du fichier. Valide le fichier avant de toucher à la base. */
export async function importAllData(data: unknown, database: AppDB = db): Promise<void> {
  const file = data as Partial<BackupFile> | null
  if (!file || file.app !== 'diario-sintomas' || file.formatVersion !== 1 || typeof file.tables !== 'object' || !file.tables) {
    throw new Error('Fichier de sauvegarde non reconnu')
  }
  const tables = file.tables as Record<string, unknown[]>
  for (const t of BACKUP_TABLES) {
    if (tables[t] !== undefined && !Array.isArray(tables[t])) throw new Error(`Table invalide : ${t}`)
  }
  await database.transaction('rw', BACKUP_TABLES.map((t) => database.table(t)), async () => {
    for (const t of BACKUP_TABLES) {
      await database.table(t).clear()
      if (tables[t]?.length) await database.table(t).bulkPut(tables[t])
    }
  })
}
