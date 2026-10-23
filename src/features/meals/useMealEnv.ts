import { useMemo } from 'react'
import { DEFAULT_SEED_SOURCES } from '@/data/seedMeta'
import { useFoodCatalog } from '@/db/foods'
import { useRecipes } from '@/db/meals'
import { useSettings } from '@/db/settings'
import { buildContext, type DetectionContext } from '@/domain/detection'
import type { Lang, MealItem, Recipe } from '@/domain/types'
import { foodName, useLang } from '@/features/foods/shared'

export interface MealEnv {
  ctx: DetectionContext
  recipes: Recipe[]
  recipeById: Map<string, Recipe>
  lang: Lang
}

/** Tout ce qu'il faut pour analyser un repas : catalogue d'aliments, recettes, profil d'alerte. `null` tant que ça charge. */
export function useMealEnv(): MealEnv | null {
  const catalog = useFoodCatalog()
  const settings = useSettings()
  const recipes = useRecipes()
  const lang = useLang()
  return useMemo(() => {
    if (!catalog || !settings) return null
    const ctx = buildContext({
      foods: catalog,
      recipes: recipes.map((r) => ({ id: r.id, kind: r.kind, items: r.items })),
      watchedFlags: settings.profile.watchedFlags,
      derivatives: DEFAULT_SEED_SOURCES.derivatives,
      excludedFromTextDetection: DEFAULT_SEED_SOURCES.excludedFromTextDetection,
    })
    return { ctx, recipes, recipeById: new Map(recipes.map((r) => [r.id, r])), lang }
  }, [catalog, settings, recipes, lang])
}

/** Nom affichable d'un élément de repas. `deletedLabel` : recette supprimée depuis. */
export function itemName(item: MealItem, env: MealEnv, deletedLabel: string): string {
  if (item.kind === 'free') return item.text
  if (item.kind === 'recipe') return env.recipeById.get(item.recipeId)?.name ?? deletedLabel
  const f = env.ctx.byId.get(item.foodId)
  return f ? foodName(f, env.lang) : item.foodId
}
