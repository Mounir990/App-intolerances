import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { deleteMeal, deleteRecipe, saveMeal, saveRecipe, setMealFavorite, setRecipeFavorite } from './meals'
import { toTs } from '@/domain/time'

let n = 0
let db: AppDB
beforeEach(() => { db = new AppDB(`meals-${++n}`) })

describe('enregistrement d\'un repas', () => {
  const draft = { date: '2026-03-05', time: '13:20', type: 'lunch' as const, items: [{ kind: 'food' as const, foodId: 'tomate' }] }

  it('horodate précisément (date + heure) et dérive le jour', async () => {
    const id = await saveMeal(draft, db)
    const m = (await db.meals.get(id))!
    expect(m.ts).toBe(toTs('2026-03-05', '13:20'))
    expect(m.date).toBe('2026-03-05')
    expect(m.items).toEqual(draft.items)
    expect(m.createdAt).toBeGreaterThan(0)
  })
  it('modifie un repas existant (heure, jour, type) en gardant son identifiant et sa date de création', async () => {
    const id = await saveMeal(draft, db)
    const created = (await db.meals.get(id))!.createdAt
    await saveMeal({ ...draft, id, date: '2026-03-04', time: '20:05', type: 'dinner', note: ' tard ' }, db)
    const m = (await db.meals.get(id))!
    expect(await db.meals.count()).toBe(1)
    expect(m).toMatchObject({ date: '2026-03-04', type: 'dinner', note: 'tard', ts: toTs('2026-03-04', '20:05'), createdAt: created })
  })
  it('refuse un repas vide, retire les textes libres vides', async () => {
    await expect(saveMeal({ ...draft, items: [] }, db)).rejects.toThrow(/au moins/)
    await expect(saveMeal({ ...draft, items: [{ kind: 'free', text: '   ' }] }, db)).rejects.toThrow(/au moins/)
    const id = await saveMeal({ ...draft, items: [...draft.items, { kind: 'free', text: '  pain  ' }, { kind: 'free', text: '' }] }, db)
    expect((await db.meals.get(id))!.items).toEqual([...draft.items, { kind: 'free', text: 'pain' }])
  })
  it('conserve les alertes acceptées', async () => {
    const id = await saveMeal({ ...draft, acknowledgedAlerts: ['personal:avocat'] }, db)
    expect((await db.meals.get(id))!.acknowledgedAlerts).toEqual(['personal:avocat'])
  })
  it('favori et suppression', async () => {
    const id = await saveMeal(draft, db)
    await setMealFavorite(id, true, db)
    expect((await db.meals.get(id))!.favorite).toBe(true)
    await deleteMeal(id, db)
    expect(await db.meals.get(id)).toBeUndefined()
  })
})

describe('recettes', () => {
  const recipe = { name: 'Lasagnes', kind: 'home' as const, items: [{ foodId: 'pates_de_ble' }, { foodId: 'tomate' }, { foodId: 'tomate' }] }

  it('crée une recette maison (ingrédients dédoublonnés)', async () => {
    const id = await saveRecipe(recipe, db)
    const r = (await db.recipes.get(id))!
    expect(r).toMatchObject({ name: 'Lasagnes', kind: 'home', favorite: false })
    expect(r.items.map((i) => i.foodId)).toEqual(['pates_de_ble', 'tomate'])
  })
  it('une recette restaurant garde le nom du restaurant ; une recette maison l\'oublie', async () => {
    const resto = await saveRecipe({ ...recipe, name: 'Pizza', kind: 'restaurant', place: ' Chez Marco ' }, db)
    expect((await db.recipes.get(resto))!).toMatchObject({ kind: 'restaurant', place: 'Chez Marco' })
    const home = await saveRecipe({ ...recipe, kind: 'home', place: 'Chez Marco' }, db)
    expect((await db.recipes.get(home))!.place).toBeUndefined()
  })
  it('exige un nom et au moins un ingrédient', async () => {
    await expect(saveRecipe({ ...recipe, name: ' ' }, db)).rejects.toThrow(/nom/)
    await expect(saveRecipe({ ...recipe, items: [] }, db)).rejects.toThrow(/ingrédient/)
  })
  it('modifier, mettre en favori, supprimer : les repas qui l\'ont utilisée sont conservés', async () => {
    const id = await saveRecipe(recipe, db)
    await saveRecipe({ ...recipe, id, name: 'Lasagnes maison', kind: 'restaurant' }, db)
    await setRecipeFavorite(id, true, db)
    expect((await db.recipes.get(id))!).toMatchObject({ name: 'Lasagnes maison', kind: 'restaurant', favorite: true })
    const mealId = await saveMeal({ date: '2026-03-05', time: '13:00', type: 'lunch', items: [{ kind: 'recipe', recipeId: id }] }, db)
    await deleteRecipe(id, db)
    expect(await db.recipes.get(id)).toBeUndefined()
    expect(await db.meals.get(mealId)).toBeDefined()
  })
})
