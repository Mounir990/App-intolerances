import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, PageHeader, Segmented } from '@/components/ui'
import { addCustomFood } from '@/db/foods'
import { deleteRecipe, saveRecipe, useRecipe } from '@/db/meals'
import { analyzeMeal } from '@/domain/detection'
import { EMPTY_FOOD_VALUES } from '@/domain/foods'
import type { Recipe, RecipeKind } from '@/domain/types'
import { foodName } from '@/features/foods/shared'
import { FoodSearch } from './FoodSearch'
import { MealAnalysisPanel } from './MealAnalysisPanel'
import { useMealEnv, type MealEnv } from './useMealEnv'

function Editor({ env, initial }: { env: MealEnv; initial?: Recipe }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { ctx } = env
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<RecipeKind>(initial?.kind ?? 'home')
  const [place, setPlace] = useState(initial?.place ?? '')
  const [foodIds, setFoodIds] = useState<string[]>(initial?.items.map((i) => i.foodId) ?? [])
  const [favorite, setFavorite] = useState(initial?.favorite ?? false)
  const [error, setError] = useState('')
  const input = 'min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200'

  // Analyse comme un repas : mêmes étiquettes calculées à partir des ingrédients.
  const analysis = useMemo(() => {
    const a = analyzeMeal(foodIds.map((foodId) => ({ kind: 'food' as const, foodId })), ctx)
    return kind === 'restaurant' ? { ...a, needsReview: true, restaurantRecipes: ['x'] } : a
  }, [foodIds, kind, ctx])

  const addFood = (id: string) => setFoodIds((cur) => (cur.includes(id) ? cur : [...cur, id]))
  const createFood = async (n: string) => addFood(await addCustomFood({ ...EMPTY_FOOD_VALUES, nameFr: n, nameEs: n, category: 'Mes aliments' }))

  const save = async () => {
    if (!name.trim()) { setError(t('meals.recipe.needName')); return }
    if (foodIds.length === 0) { setError(t('meals.recipe.needIngredients')); return }
    await saveRecipe({ id: initial?.id, name, kind, place, items: foodIds.map((foodId) => ({ foodId })), favorite })
    navigate('/add/meal/recipes', { replace: true })
  }
  const remove = async () => {
    if (initial && window.confirm(t('meals.recipe.deleteConfirm'))) {
      await deleteRecipe(initial.id)
      navigate('/add/meal/recipes', { replace: true })
    }
  }

  return (
    <>
      <PageHeader title={t(initial ? 'meals.recipe.edit' : 'meals.recipe.new')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/add/meal/recipes" className="inline-flex min-h-11 items-center text-sage-700">← {t('meals.recipe.title')}</Link>
        <Card>
          <Segmented<RecipeKind> label={t('meals.recipe.title')} value={kind} onChange={setKind}
            options={[{ value: 'home', label: `🏠 ${t('meals.recipe.kind.home')}` }, { value: 'restaurant', label: `🍴 ${t('meals.recipe.kind.restaurant')}` }]} />
          {kind === 'restaurant' && <p className="mt-3 text-sm text-ink-soft">{t('meals.recipe.restaurantHint')}</p>}
          <label className="mt-4 block"><span className="mb-1 block font-medium">{t('meals.recipe.name')}</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} /></label>
          {kind === 'restaurant' && (
            <label className="mt-3 block"><span className="mb-1 block font-medium">{t('meals.recipe.place')}</span>
              <input className={input} value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          )}
        </Card>

        <Card title={t('meals.recipe.ingredients')}>
          {foodIds.length > 0 && (
            <ul className="mb-3 flex flex-wrap gap-2">
              {foodIds.map((id) => {
                const f = ctx.byId.get(id)
                const label = f ? foodName(f, env.lang) : id
                return (
                  <li key={id} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-cat-meal-tint py-1 pl-4 pr-1 text-cat-meal-ink">
                    <span>{label}</span>
                    <button type="button" aria-label={`${t('meals.form.remove')} ${label}`} onClick={() => setFoodIds((cur) => cur.filter((x) => x !== id))}
                      className="grid h-10 w-10 place-items-center rounded-full text-xl active:bg-black/10">×</button>
                  </li>
                )
              })}
            </ul>
          )}
          <FoodSearch ctx={ctx} lang={env.lang} onPickFood={addFood} onCreate={(n) => void createFood(n)} />
        </Card>

        <MealAnalysisPanel analysis={analysis} ctx={ctx} />

        {error && <p role="alert" className="text-alert">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant={favorite ? 'primary' : 'soft'} aria-pressed={favorite} onClick={() => setFavorite((f) => !f)}>{favorite ? '★' : '☆'} {t('meals.recipe.favorite')}</Button>
        </div>
        <Button variant="primary" className="min-h-16 w-full text-lg" onClick={() => void save()}>{t('meals.recipe.save')}</Button>
        {initial && <Button variant="danger" className="w-full" onClick={() => void remove()}>{t('meals.recipe.delete')}</Button>}
      </div>
    </>
  )
}

/** Création (`/add/meal/recipes/new`) ou modification d'une recette. */
export function RecipeEditorPage() {
  const { id } = useParams()
  const env = useMealEnv()
  const editing = id && id !== 'new' ? id : undefined
  const recipe = useRecipe(editing)
  if (!env || (editing && !recipe)) return null
  return <Editor key={recipe?.id ?? 'new'} env={env} initial={recipe ? { ...recipe, kind: recipe.kind ?? 'home' } : undefined} />
}
