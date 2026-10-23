import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings, ContextEntry, CycleStart, DayRecord, DigestiveEntry, ExtraEntry,
  GyneEvent, Meal, PainEntry, Recipe,
} from '@/domain/types'
import type { CustomFoodRecord, FoodOverride, SeedFoodRecord, SourceRecord } from '@/domain/foods'

/** Ligne clé/valeur pour les réglages (une seule ligne : key = 'app'). */
export interface SettingsRow { key: string; value: AppSettings }
/** Métadonnées techniques : key = 'seed' (version/hash de la base d'origine) ou 'seedReport'. */
export interface MetaRow { key: string; value: unknown }

/**
 * Base locale (IndexedDB). Rien ne quitte l'appareil.
 * Pour changer un index : ajouter un `version(n+1)` — ne jamais modifier une version existante.
 *
 * Aliments : trois tables distinctes pour ne jamais mélanger l'origine et l'utilisatrice.
 *   foods         = base d'origine (seed), rechargeable sans risque
 *   foodOverrides = mes modifications, par aliment ET par champ
 *   customFoods   = mes propres aliments
 */
export class AppDB extends Dexie {
  settings!: EntityTable<SettingsRow, 'key'>
  meta!: EntityTable<MetaRow, 'key'>
  foods!: EntityTable<SeedFoodRecord, 'id'>
  foodOverrides!: EntityTable<FoodOverride, 'key'>
  customFoods!: EntityTable<CustomFoodRecord, 'id'>
  sources!: EntityTable<SourceRecord, 'id'>
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
    // v3 : base d'aliments importée du CSV + modifications + aliments perso.
    this.version(3).stores({
      meta: 'key',
      foods: 'id, category',
      foodOverrides: 'key, foodId',
      customFoods: 'id, category',
    })
    // v4 : table des sources (légende S1-S12 + « Ma source » de l'utilisatrice).
    this.version(4).stores({ sources: 'id, origin, foodId' })
  }
}

export const db = new AppDB()

/** Tables du journal (hors réglages et aliments) — utile pour export, effacement, rapport. */
export const JOURNAL_TABLES = ['meals', 'cycleStarts', 'pain', 'gyne', 'digestive', 'extra', 'context', 'days', 'recipes'] as const

/** Nouvel identifiant (uuid v4). */
export const newId = (): string => crypto.randomUUID()
