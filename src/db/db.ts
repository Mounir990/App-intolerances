import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings, ContextEntry, CycleStart, DayRecord, DigestiveEntry, ExtraEntry,
  Food, GyneEvent, Meal, PainEntry, Recipe,
} from '@/domain/types'

/** Ligne clé/valeur pour les réglages (une seule ligne : key = 'app'). */
export interface SettingsRow { key: string; value: AppSettings }

/**
 * Base locale (IndexedDB). Rien ne quitte l'appareil.
 * Pour changer un index : ajouter un `db.version(n+1)` — ne jamais modifier une version existante.
 */
class AppDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>
  foods!: EntityTable<Food, 'id'>
  recipes!: EntityTable<Recipe, 'id'>
  meals!: EntityTable<Meal, 'id'>
  cycleStarts!: EntityTable<CycleStart, 'id'>
  pain!: EntityTable<PainEntry, 'id'>
  gyne!: EntityTable<GyneEvent, 'id'>
  digestive!: EntityTable<DigestiveEntry, 'id'>
  extra!: EntityTable<ExtraEntry, 'id'>
  context!: EntityTable<ContextEntry, 'id'>
  days!: EntityTable<DayRecord, 'date'>

  constructor(name = 'intolerances') {
    super(name)
    this.version(1).stores({
      settings: 'key',
      foods: 'id, source, category',
      recipes: 'id, favorite',
      meals: 'id, ts, date, favorite',
      cycleStarts: 'id, ts, date',
      pain: 'id, ts, date',
      gyne: 'id, ts, date, kind',
      digestive: 'id, ts, date, kind',
      extra: 'id, ts, date, group, kind',
      context: 'id, ts, date, kind',
    })
    // v2 : statut « journée terminée » (utilisé plus tard par les analyses).
    this.version(2).stores({ days: 'date, completed' })
  }
}

export const db = new AppDB()

/** Tables du journal (hors réglages et aliments) — utile pour export, effacement, rapport. */
export const JOURNAL_TABLES = ['meals', 'cycleStarts', 'pain', 'gyne', 'digestive', 'extra', 'context', 'days'] as const

/** Nouvel identifiant (uuid v4). */
export const newId = (): string => crypto.randomUUID()
