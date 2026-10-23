import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type AppDB } from './db'
import { dateKey, toTs } from '@/domain/time'
import type { Meal, MealItem, MealType, Recipe, RecipeItem, RecipeKind } from '@/domain/types'

// ───────────────────────── Repas ─────────────────────────

export interface MealDraft {
  /** Présent = modification d'un repas existant. */
  id?: string
  /** Jour local AAAA-MM-JJ et heure HH:MM choisis par l'utilisatrice (ts précis = date + heure). */
  date: string
  time: string
  type: MealType
  items: MealItem[]
  note?: string
  favorite?: boolean
  /** Alertes vues puis acceptées (« Enregistrer quand même »). */
  acknowledgedAlerts?: string[]
}

const cleanItems = (items: MealItem[]): MealItem[] =>
  items
    .map((i) => (i.kind === 'free' ? { ...i, text: i.text.trim() } : i))
    .filter((i) => i.kind !== 'free' || i.text.length > 0)

/** Crée ou met à jour un repas. Un repas doit contenir au moins un élément. */
export async function saveMeal(draft: MealDraft, database: AppDB = db): Promise<string> {
  const items = cleanItems(draft.items)
  if (items.length === 0) throw new Error('Un repas doit contenir au moins un aliment')
  const ts = toTs(draft.date, draft.time)
  const now = Date.now()
  const fields = {
    ts, date: dateKey(ts), type: draft.type, items,
    note: draft.note?.trim() || undefined,
    favorite: draft.favorite ?? false,
    acknowledgedAlerts: draft.acknowledgedAlerts?.length ? draft.acknowledgedAlerts : undefined,
    updatedAt: now,
  }
  if (draft.id) {
    const existing = await database.meals.get(draft.id)
    if (!existing) throw new Error('Repas introuvable')
    await database.meals.put({ ...existing, ...fields })
    return draft.id
  }
  const id = newId()
  await database.meals.add({ id, createdAt: now, ...fields })
  return id
}

export const deleteMeal = (id: string, database: AppDB = db) => database.meals.delete(id)

export async function setMealFavorite(id: string, favorite: boolean, database: AppDB = db) {
  await database.meals.update(id, { favorite, updatedAt: Date.now() })
}

/** Repas d'un jour, du plus tôt au plus tard. */
export function useMealsOfDay(date: string): Meal[] {
  return useLiveQuery(async () => (await db.meals.where('date').equals(date).toArray()).sort((a, b) => a.ts - b.ts), [date], [])
}

/** Derniers repas (base des « récents » et des favoris). */
export function useRecentMealPool(): Meal[] {
  return useLiveQuery(() => db.meals.orderBy('ts').reverse().limit(300).toArray(), [], [])
}

export function useMeal(id: string | undefined): Meal | undefined {
  return useLiveQuery(async () => (id ? db.meals.get(id) : undefined), [id])
}

// ───────────────────────── Recettes ─────────────────────────

export interface RecipeDraft {
  id?: string
  name: string
  kind: RecipeKind
  place?: string
  items: RecipeItem[]
  favorite?: boolean
}

/** Crée ou met à jour une recette (nom et au moins un ingrédient obligatoires). */
export async function saveRecipe(draft: RecipeDraft, database: AppDB = db): Promise<string> {
  const name = draft.name.trim()
  if (!name) throw new Error('Une recette doit avoir un nom')
  const seen = new Set<string>()
  const items = draft.items.filter((i) => !seen.has(i.foodId) && seen.add(i.foodId))
  if (items.length === 0) throw new Error('Une recette doit contenir au moins un ingrédient')
  const now = Date.now()
  const fields = {
    name, kind: draft.kind, place: draft.kind === 'restaurant' ? draft.place?.trim() || undefined : undefined,
    items, favorite: draft.favorite ?? false, updatedAt: now,
  }
  if (draft.id) {
    const existing = await database.recipes.get(draft.id)
    if (!existing) throw new Error('Recette introuvable')
    await database.recipes.put({ ...existing, ...fields })
    return draft.id
  }
  const id = newId()
  await database.recipes.add({ id, createdAt: now, ...fields })
  return id
}

/** Supprime une recette. Les repas qui l'ont utilisée sont conservés (la recette y apparaît « supprimée »). */
export const deleteRecipe = (id: string, database: AppDB = db) => database.recipes.delete(id)

export async function setRecipeFavorite(id: string, favorite: boolean, database: AppDB = db) {
  await database.recipes.update(id, { favorite, updatedAt: Date.now() })
}

/** Recettes : favorites d'abord, puis par nom. */
export function useRecipes(): Recipe[] {
  return useLiveQuery(async () => {
    const all = await db.recipes.toArray()
    return all.map((r) => ({ ...r, kind: r.kind ?? 'home' })).sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name))
  }, [], [])
}

export function useRecipe(id: string | undefined): Recipe | undefined {
  return useLiveQuery(async () => (id ? db.recipes.get(id) : undefined), [id])
}
