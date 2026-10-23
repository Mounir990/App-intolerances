import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type AppDB } from './db'
import { DEFAULT_SEED_SOURCES, type SeedSources } from '@/data/seedMeta'
import { resolveCustomFood, resolveSeedFood, seedFieldValue } from '@/domain/effective'
import {
  FODMAP_BLOCK, HISTAMINE_BLOCK,
  type CustomFoodRecord, type EffectiveFood, type FoodFieldValues, type FoodOverride, type OverridableField,
  type SeedFoodRecord, type SeedReport,
} from '@/domain/foods'
import { parseSeedCsv } from '@/domain/seedCsv'
import { foodKeywords } from '@/domain/detection'

// ───────────────────────── Amorçage (seed) ─────────────────────────

/** Hash rapide (cyrb53) : détecte un changement de contenu même si on oublie d'incrémenter la version. */
export function hashString(str: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16)
}

const signature = (s: SeedSources) =>
  hashString(JSON.stringify([s.csv.replace(/\r\n/g, '\n'), s.flags, s.aliases]))

/**
 * Charge la base d'origine dans la table « foods » au premier lancement, puis à chaque
 * changement de seedVersion / de contenu. Ne touche JAMAIS à foodOverrides ni customFoods.
 * Un aliment qui disparaît du nouveau seed est conservé s'il est encore utilisé
 * (modifié par l'utilisatrice, ou présent dans un repas/une recette).
 */
export async function ensureSeed(database: AppDB = db, sources: SeedSources = DEFAULT_SEED_SOURCES): Promise<SeedReport | null> {
  const hash = signature(sources)
  const current = (await database.meta.get('seed'))?.value as { version: number; hash: string } | undefined
  if (current && current.version === sources.version && current.hash === hash) return null

  const parsed = parseSeedCsv(sources.csv)
  if (parsed.fatal) {
    // Fichier inutilisable : on ne touche pas à la base existante et on garde la trace.
    const report: SeedReport = { version: sources.version, hash, importedAt: Date.now(), imported: 0, rejected: [], warnings: [{ line: 1, message: parsed.fatal }] }
    await database.meta.put({ key: 'seedReport', value: report })
    console.warn('[seed] import impossible :', parsed.fatal)
    return report
  }

  const records: SeedFoodRecord[] = parsed.foods.map((f) => ({
    ...f,
    flags: sources.flags[f.id] ?? [],
    aliases: sources.aliases[f.id] ?? [],
  }))
  const report: SeedReport = {
    version: sources.version, hash, importedAt: Date.now(), imported: records.length,
    rejected: parsed.rejected, warnings: parsed.warnings,
  }

  await database.transaction('rw', [database.foods, database.foodOverrides, database.meals, database.recipes, database.meta], async () => {
    const newIds = new Set(records.map((r) => r.id))
    const stale = (await database.foods.toCollection().primaryKeys()).filter((id) => !newIds.has(id))
    if (stale.length) {
      const used = new Set<string>((await database.foodOverrides.toArray()).map((o) => o.foodId))
      for (const m of await database.meals.toArray()) for (const i of m.items) if (i.kind === 'food') used.add(i.foodId)
      for (const r of await database.recipes.toArray()) for (const i of r.items) used.add(i.foodId)
      await database.foods.bulkDelete(stale.filter((id) => !used.has(id)))
    }
    await database.foods.bulkPut(records)
    await database.meta.put({ key: 'seed', value: { version: sources.version, hash } })
    await database.meta.put({ key: 'seedReport', value: report })
  })
  for (const r of report.rejected) console.warn(`[seed] ligne ${r.line} ignorée (${r.id ?? '?'}) :`, r.reasons.join(' ; '))
  for (const w of report.warnings) console.info(`[seed] ligne ${w.line} (${w.id ?? '?'}) :`, w.message)
  return report
}

// ───────────────────────── Catalogue effectif ─────────────────────────

/** Seed + modifications + aliments perso, prêts à l'emploi. */
export async function loadCatalog(database: AppDB = db): Promise<EffectiveFood[]> {
  const [seeds, overrides, customs] = await Promise.all([
    database.foods.toArray(), database.foodOverrides.toArray(), database.customFoods.toArray(),
  ])
  const byFood = new Map<string, FoodOverride[]>()
  for (const o of overrides) (byFood.get(o.foodId) ?? byFood.set(o.foodId, []).get(o.foodId)!).push(o)
  return [
    ...seeds.map((s) => resolveSeedFood(s, byFood.get(s.id) ?? [])),
    ...customs.map(resolveCustomFood),
  ]
}

/** Hook réactif : se met à jour dès qu'une fiche est modifiée. */
export function useFoodCatalog(): EffectiveFood[] | undefined {
  return useLiveQuery(() => loadCatalog(), [])
}

export function useSeedReport(): SeedReport | undefined {
  return useLiveQuery(async () => (await db.meta.get('seedReport'))?.value as SeedReport | undefined, [])
}

// ───────────────────────── Modifications (overrides) ─────────────────────────

const overrideKey = (foodId: string, field: OverridableField) => `${foodId}|${field}`

/**
 * Modifie UN champ d'un aliment. Seed : crée/maj un override (le seed reste intact, ce qui
 * permet « revenir à la valeur d'origine »). Aliment perso : met à jour la fiche directement.
 */
export async function setFieldValue<F extends OverridableField>(
  foodId: string, field: F, value: FoodFieldValues[F], database: AppDB = db,
): Promise<void> {
  const custom = await database.customFoods.get(foodId)
  if (custom) {
    await database.customFoods.update(foodId, { [field]: value, updatedAt: Date.now() } as never)
    return
  }
  const seed = await database.foods.get(foodId)
  if (!seed) throw new Error(`Aliment introuvable : ${foodId}`)
  await database.foodOverrides.put({
    key: overrideKey(foodId, field), foodId, field, value,
    seedAtEdit: seedFieldValue(seed, field), updatedAt: Date.now(),
  })
}

/** Remet un champ à la valeur d'origine du seed (supprime ma modification). */
export async function revertField(foodId: string, field: OverridableField, database: AppDB = db): Promise<void> {
  await database.foodOverrides.delete(overrideKey(foodId, field))
}

/** Remet tous les champs d'un aliment à l'origine. */
export async function revertAllFields(foodId: string, database: AppDB = db): Promise<void> {
  await database.foodOverrides.where('foodId').equals(foodId).delete()
}

/**
 * « Je confirme cette information » : enregistre les valeurs actuelles d'un bloc (histamine ou
 * FODMAP) comme les miennes, sans les changer — l'information devient « vérifiée par moi ».
 */
export async function confirmBlock(food: EffectiveFood, block: 'histamine' | 'fodmap', database: AppDB = db): Promise<void> {
  const fields = block === 'histamine' ? HISTAMINE_BLOCK : FODMAP_BLOCK
  for (const field of fields) {
    await setFieldValue(food.id, field, food[field] as never, database)
  }
}

// ───────────────────────── Aliments personnalisés ─────────────────────────

export type CustomFoodDraft = Omit<CustomFoodRecord, 'id' | 'createdAt' | 'updatedAt' | 'aliases'> & { aliases?: string[] }

export async function addCustomFood(draft: CustomFoodDraft, database: AppDB = db): Promise<string> {
  const nameFr = draft.nameFr.trim()
  const nameEs = draft.nameEs.trim()
  if (!nameFr && !nameEs) throw new Error('Un nom (FR ou ES) est obligatoire')
  const now = Date.now()
  const id = `custom_${newId().slice(0, 8)}`
  await database.customFoods.add({
    ...draft,
    id,
    // Si une seule langue est saisie, on la reprend dans l'autre pour que la recherche marche partout.
    nameFr: nameFr || nameEs,
    nameEs: nameEs || nameFr,
    category: draft.category.trim() || 'Mes aliments',
    aliases: draft.aliases ?? [],
    createdAt: now,
    updatedAt: now,
  })
  return id
}

/** Supprime UNIQUEMENT un aliment créé par l'utilisatrice ; les aliments de la base d'origine sont protégés. */
export async function deleteCustomFood(foodId: string, database: AppDB = db): Promise<void> {
  const custom = await database.customFoods.get(foodId)
  if (!custom) throw new Error('Seuls les aliments ajoutés par toi peuvent être supprimés')
  await database.customFoods.delete(foodId)
}

/** Ids des aliments retrouvables par un nom/alias (utile pour les tests et la recherche). */
export const keywordsOf = foodKeywords
