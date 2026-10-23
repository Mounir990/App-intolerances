import { analyzeMeal, type DetectionContext, type FoodAlert } from './detection'
import type { Meal, MealItem, MealType } from './types'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'tea', 'dinner', 'snack']

/**
 * Type de repas proposé selon l'heure (toujours modifiable en un tap) :
 * petit-déjeuner 5 h–11 h, déjeuner 11 h–15 h, goûter 15 h–18 h 30, dîner 18 h 30–22 h, snack sinon.
 */
export function suggestMealType(hour: number, minute = 0): MealType {
  const t = hour * 60 + minute
  if (t >= 5 * 60 && t < 11 * 60) return 'breakfast'
  if (t >= 11 * 60 && t < 15 * 60) return 'lunch'
  if (t >= 15 * 60 && t < 18 * 60 + 30) return 'tea'
  if (t >= 18 * 60 + 30 && t < 22 * 60) return 'dinner'
  return 'snack'
}

/** Clé d'un élément de repas (pour comparer deux repas sans tenir compte de l'ordre). */
export function itemKey(item: MealItem): string {
  return item.kind === 'food' ? `f:${item.foodId}` : item.kind === 'recipe' ? `r:${item.recipeId}` : `t:${item.text.trim().toLowerCase()}`
}

export function mealSignature(items: MealItem[]): string {
  return items.map(itemKey).sort().join('|')
}

/** Repas récents : les plus récents d'abord, sans doublon de composition, sans repas vide. */
export function recentMeals(meals: Meal[], limit = 8): Meal[] {
  const seen = new Set<string>()
  const out: Meal[] = []
  for (const m of [...meals].sort((a, b) => b.ts - a.ts)) {
    const sig = mealSignature(m.items)
    if (!m.items.length || seen.has(sig)) continue
    seen.add(sig)
    out.push(m)
    if (out.length >= limit) break
  }
  return out
}

/** Repas favoris, sans doublon de composition. */
export function favoriteMeals(meals: Meal[]): Meal[] {
  return recentMeals(meals.filter((m) => m.favorite), Infinity)
}

/**
 * Alertes qui demandent une confirmation avant d'enregistrer : l'allergène confirmé (rouge) et la
 * réactivité croisée à forte littérature (orange). Les alertes douces (preuve plus faible) et la
 * surveillance des familles restent affichées dans le formulaire, sans bloquer.
 */
export const isBlockingAlert = (a: FoodAlert) => a.kind === 'personal' || a.kind === 'cross_latex'
export const blockingAlerts = (alerts: FoodAlert[]) => alerts.filter(isBlockingAlert)

/** Identifiant d'une alerte acceptée, stocké avec le repas (« j'ai vu l'alerte et j'ai enregistré quand même »). */
export const alertKey = (a: FoodAlert) => `${a.kind}:${a.foodId ?? a.flag ?? ''}`

/** Éléments du repas qui déclenchent une alerte bloquante (ce que « Retirer l'aliment » enlève). */
export function itemsWithBlockingAlerts(items: MealItem[], ctx: DetectionContext): MealItem[] {
  return items.filter((item) => blockingAlerts(analyzeMeal([item], ctx).alerts).length > 0)
}
