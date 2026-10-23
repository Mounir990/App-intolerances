import { describe, expect, it } from 'vitest'
import { analyzeMeal, buildContext, scanText } from './detection'
import { alertKey, blockingAlerts, favoriteMeals, itemsWithBlockingAlerts, mealSignature, recentMeals, suggestMealType } from './meals'
import type { Meal, MealItem } from './types'
import { realCatalog, realContext } from '@/test/fixtures'

const meal = (id: string, ts: number, items: MealItem[], favorite = false): Meal =>
  ({ id, ts, date: '2026-03-01', createdAt: ts, updatedAt: ts, type: 'lunch', items, favorite })
const food = (foodId: string): MealItem => ({ kind: 'food', foodId })

describe('type de repas proposé selon l\'heure', () => {
  it.each([
    [7, 0, 'breakfast'], [10, 59, 'breakfast'], [11, 0, 'lunch'], [14, 59, 'lunch'], [15, 0, 'tea'], [18, 29, 'tea'],
    [18, 30, 'dinner'], [21, 59, 'dinner'], [22, 0, 'snack'], [23, 45, 'snack'], [2, 30, 'snack'], [4, 59, 'snack'], [5, 0, 'breakfast'],
  ] as const)('%ih%i → %s', (h, m, expected) => expect(suggestMealType(h, m)).toBe(expected))
})

describe('repas récents et favoris', () => {
  const pool = [
    meal('a', 100, [food('tomate'), food('oignon')]),
    meal('b', 300, [food('oignon'), food('tomate')]), // même composition que « a », dans un autre ordre
    meal('c', 200, [food('pomme')], true),
    meal('d', 400, []),
    meal('e', 50, [{ kind: 'free', text: 'Pizza ' }], true),
    meal('f', 40, [{ kind: 'free', text: 'pizza' }]),
  ]
  it('la composition ne dépend pas de l\'ordre ni de la casse du texte libre', () => {
    expect(mealSignature(pool[0].items)).toBe(mealSignature(pool[1].items))
    expect(mealSignature(pool[4].items)).toBe(mealSignature(pool[5].items))
  })
  it('liste les plus récents d\'abord, sans doublon et sans repas vide', () => {
    expect(recentMeals(pool).map((m) => m.id)).toEqual(['b', 'c', 'e'])
  })
  it('respecte la limite', () => {
    expect(recentMeals(pool, 2).map((m) => m.id)).toEqual(['b', 'c'])
  })
  it('liste les favoris', () => {
    expect(favoriteMeals(pool).map((m) => m.id)).toEqual(['c', 'e'])
  })
})

describe('alertes bloquantes (fenêtre avant l\'enregistrement)', () => {
  const ctx = realContext()
  const alertsOf = (...items: MealItem[]) => analyzeMeal(items, ctx).alerts

  it('l\'allergène confirmé et la réactivité croisée forte bloquent', () => {
    expect(blockingAlerts(alertsOf(food('avocat'))).map((a) => a.kind)).toEqual(['personal'])
    expect(blockingAlerts(alertsOf(food('kiwi'))).map((a) => a.kind)).toEqual(['cross_latex'])
  })
  it('l\'alerte douce (preuve plus faible) et la famille surveillée ne bloquent pas', () => {
    expect(blockingAlerts(alertsOf(food('fraise')))).toEqual([])
    expect(blockingAlerts(alertsOf(food('tomate')))).toEqual([])
    expect(alertsOf(food('tomate')).length).toBeGreaterThan(0) // mais elles restent affichées
  })
  it('un texte libre contenant « banane » bloque aussi', () => {
    expect(blockingAlerts(alertsOf({ kind: 'free', text: 'gâteau à la banane' })).map((a) => a.kind)).toEqual(['personal'])
  })
  it('« Retirer l\'aliment » ne retire que les éléments fautifs', () => {
    const items: MealItem[] = [food('pomme'), food('kiwi'), { kind: 'free', text: 'purée de banane' }, food('tomate'), food('riz_blanc')]
    expect(itemsWithBlockingAlerts(items, ctx)).toEqual([food('kiwi'), { kind: 'free', text: 'purée de banane' }])
  })
  it('une recette qui contient un fruit à risque est retirée en bloc', () => {
    const c = buildContext({ foods: realCatalog(), recipes: [{ id: 'r', items: [{ foodId: 'pomme' }, { foodId: 'kiwi' }] }] })
    expect(itemsWithBlockingAlerts([{ kind: 'recipe', recipeId: 'r' }, food('pomme')], c)).toEqual([{ kind: 'recipe', recipeId: 'r' }])
  })
  it('les identifiants d\'alertes acceptées sont stables', () => {
    expect(alertsOf(food('avocat')).map(alertKey)).toEqual(['personal:avocat'])
    expect(scanText('paprika', ctx).alerts.map(alertKey)).toEqual(['watched:solanaceae'])
  })
})

describe('un aliment créé par l\'utilisatrice ne contourne pas l\'alerte', () => {
  const custom = (id: string, nameFr: string, nameEs = nameFr) => ({
    ...realCatalog()[0], id, origin: 'custom' as const, nameFr, nameEs, aliases: [], flags: [], personalAlert: '' as const,
  })
  it('« Chips de banane » (aliment perso) déclenche l\'alerte sur la banane', () => {
    const c = buildContext({ foods: [...realCatalog(), custom('custom_x', 'Chips de banane')], derivatives: { banane: ['banane', 'platano'] } })
    expect(analyzeMeal([food('custom_x')], c).alerts).toMatchObject([{ kind: 'personal', foodId: 'banane' }])
  })
  it('détecte aussi le nom espagnol', () => {
    const c = buildContext({ foods: [...realCatalog(), custom('custom_y', 'Gâteau', 'Bizcocho de plátano')], derivatives: { banane: ['banane', 'platano'] } })
    expect(analyzeMeal([food('custom_y')], c).alerts).toMatchObject([{ kind: 'personal', foodId: 'banane' }])
  })
  it('un aliment perso sans allergène ne déclenche rien', () => {
    const c = buildContext({ foods: [...realCatalog(), custom('custom_z', 'Soupe de légumes', 'Sopa de verduras')] })
    expect(analyzeMeal([food('custom_z')], c).alerts).toEqual([])
  })
})

describe('recette maison / recette restaurant', () => {
  const ctxWith = (kind: 'home' | 'restaurant') =>
    buildContext({ foods: realCatalog(), recipes: [{ id: 'r', kind, items: [{ foodId: 'pates_de_ble' }, { foodId: 'tomate' }] }] })
  it('une recette restaurant est signalée « composition estimée » et à vérifier', () => {
    const r = analyzeMeal([{ kind: 'recipe', recipeId: 'r' }], ctxWith('restaurant'))
    expect(r.restaurantRecipes).toEqual(['r'])
    expect(r.needsReview).toBe(true)
  })
  it('une recette maison ne l\'est pas, mais ses étiquettes sont calculées de la même façon', () => {
    const home = analyzeMeal([{ kind: 'recipe', recipeId: 'r' }], ctxWith('home'))
    const resto = analyzeMeal([{ kind: 'recipe', recipeId: 'r' }], ctxWith('restaurant'))
    expect(home.restaurantRecipes).toEqual([])
    expect(home.labels).toEqual(resto.labels)
  })
  it('une recette sans type (anciennes données) est traitée comme maison', () => {
    const c = buildContext({ foods: realCatalog(), recipes: [{ id: 'r', items: [{ foodId: 'tomate' }] }] })
    expect(analyzeMeal([{ kind: 'recipe', recipeId: 'r' }], c).restaurantRecipes).toEqual([])
  })
})
