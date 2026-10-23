import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, Modal, PageHeader, Segmented } from '@/components/ui'
import { addCustomFood } from '@/db/foods'
import { saveMeal, saveRecipe, useMeal, useRecentMealPool } from '@/db/meals'
import { analyzeMeal } from '@/domain/detection'
import { EMPTY_FOOD_VALUES } from '@/domain/foods'
import { MEAL_TYPES, alertKey, blockingAlerts, favoriteMeals, itemKey, itemsWithBlockingAlerts, recentMeals, suggestMealType } from '@/domain/meals'
import { dateKey, timeKey, toTs, todayKey } from '@/domain/time'
import type { Meal, MealItem, MealType, RecipeKind } from '@/domain/types'
import { AlertsList } from '@/features/foods/shared'
import { FoodSearch } from './FoodSearch'
import { MealAnalysisPanel } from './MealAnalysisPanel'
import { itemName, useMealEnv, type MealEnv } from './useMealEnv'

const nowSuggestedType = (): MealType => { const d = new Date(); return suggestMealType(d.getHours(), d.getMinutes()) }

/** Résumé court d'un repas copiable : « Pomme, Yaourt nature et 2 de plus ». */
function summary(items: MealItem[], env: MealEnv, t: (k: string, o?: Record<string, unknown>) => string): string {
  const names = items.map((i) => itemName(i, env, t('meals.form.deletedRecipe')))
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} ${t('meals.form.more', { count: names.length - 3 })}` : names.join(', ')
}

interface FormProps { env: MealEnv; initial?: Meal }

function MealForm({ env, initial }: FormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const pool = useRecentMealPool()
  const { ctx } = env
  const now = Date.now()

  const [date, setDate] = useState(initial?.date ?? todayKey())
  const [time, setTime] = useState(initial ? timeKey(initial.ts) : timeKey(now))
  const [type, setType] = useState<MealType>(initial?.type ?? nowSuggestedType())
  const [items, setItems] = useState<MealItem[]>(initial?.items ?? [])
  const [note, setNote] = useState(initial?.note ?? '')
  const [favorite, setFavorite] = useState(initial?.favorite ?? false)
  const [dialog, setDialog] = useState(false)
  const [recipeDialog, setRecipeDialog] = useState(false)
  const [error, setError] = useState('')

  const analysis = useMemo(() => analyzeMeal(items, ctx), [items, ctx])
  const blocking = blockingAlerts(analysis.alerts)
  const favorites = useMemo(() => favoriteMeals(pool), [pool])
  const recents = useMemo(() => recentMeals(pool, 6).filter((m) => !m.favorite), [pool])

  const shift = (minutes: number) => {
    const ts = toTs(date, time) + minutes * 60_000
    setDate(dateKey(ts))
    setTime(timeKey(ts))
  }
  const add = (item: MealItem) => setItems((cur) => (cur.some((c) => itemKey(c) === itemKey(item)) ? cur : [...cur, item]))
  const removeAt = (i: number) => setItems((cur) => cur.filter((_, idx) => idx !== i))
  const createFood = async (name: string) => {
    const id = await addCustomFood({ ...EMPTY_FOOD_VALUES, nameFr: name, nameEs: name, category: 'Mes aliments' })
    add({ kind: 'food', foodId: id })
  }
  const copyMeal = (m: Meal) => { setItems(structuredClone(m.items)); setType(nowSuggestedType()); setError('') }

  const doSave = async (acknowledged: string[]) => {
    await saveMeal({ id: initial?.id, date, time, type, items, note, favorite, acknowledgedAlerts: acknowledged }, undefined)
    navigate('/add/meal', { replace: true, state: { saved: true } })
  }
  const onSave = () => {
    if (items.length === 0) { setError(t('meals.form.noIngredients')); return }
    setError('')
    if (blocking.length > 0) setDialog(true)
    else void doSave([])
  }
  const removeOffending = () => {
    const bad = new Set(itemsWithBlockingAlerts(items, ctx).map(itemKey))
    setItems((cur) => cur.filter((i) => !bad.has(itemKey(i))))
    setDialog(false)
  }

  return (
    <>
      <PageHeader title={t(initial ? 'meals.form.titleEdit' : 'meals.form.titleNew')} />
      <div className="space-y-4 px-4 pb-4">
        <Link to="/add/meal" className="inline-flex min-h-11 items-center text-sage-700">← {t('meals.subtitle')}</Link>

        {!initial && items.length === 0 && (favorites.length > 0 || recents.length > 0) && (
          <Card title={t('meals.form.recents')} hint={t('meals.form.reuseHint')}>
            <ul className="space-y-2">
              {[...favorites.map((m) => ({ m, star: true })), ...recents.map((m) => ({ m, star: false }))].map(({ m, star }) => (
                <li key={m.id}>
                  <button type="button" onClick={() => copyMeal(m)}
                    className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-cat-meal-tint px-4 py-2 text-left text-cat-meal-ink active:opacity-80">
                    <span aria-hidden="true">{star ? '★' : '↺'}</span>
                    <span><span className="text-sm opacity-80">{t(`meals.type.${m.type}`)}</span><br />{summary(m.items, env, t)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card title={t('meals.form.type')}>
          <Segmented<MealType> label={t('meals.form.type')} value={type} onChange={setType} optionClass="min-w-[7.5rem]"
            options={MEAL_TYPES.map((x) => ({ value: x, label: t(`meals.type.${x}`) }))} />
        </Card>

        <Card title={t('meals.form.when')}>
          <div className="flex items-center gap-2">
            <Button aria-label={t('meals.form.minus')} onClick={() => shift(-15)} className="shrink-0 px-3">−15</Button>
            <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} aria-label={t('meals.form.time')}
              className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white px-2 text-center text-xl font-semibold ring-1 ring-sand-200" />
            <Button aria-label={t('meals.form.plus')} onClick={() => shift(15)} className="shrink-0 px-3">+15</Button>
          </div>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('meals.form.date')}
            className="mt-3 min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200" />
        </Card>

        <Card title={t('meals.form.ingredients')}>
          {items.length === 0 ? (
            <p className="mb-3 text-ink-soft">{t('meals.form.noIngredients')}</p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {items.map((item, i) => {
                const recipe = item.kind === 'recipe' ? env.recipeById.get(item.recipeId) : undefined
                return (
                  <li key={itemKey(item)} className="inline-flex min-h-11 items-center gap-1 rounded-full bg-cat-meal-tint py-1 pl-4 pr-1 text-cat-meal-ink">
                    {item.kind === 'recipe' && <span aria-hidden="true">{recipe?.kind === 'restaurant' ? '🍴' : '🏠'}</span>}
                    {item.kind === 'free' && <span aria-hidden="true">✎</span>}
                    <span>{itemName(item, env, t('meals.form.deletedRecipe'))}</span>
                    <button type="button" aria-label={`${t('meals.form.remove')} ${itemName(item, env, '')}`} onClick={() => removeAt(i)}
                      className="grid h-10 w-10 place-items-center rounded-full text-xl active:bg-black/10">×</button>
                  </li>
                )
              })}
            </ul>
          )}
          <FoodSearch ctx={ctx} lang={env.lang} onPickFood={(foodId) => add({ kind: 'food', foodId })}
            onFreeText={(text) => add({ kind: 'free', text })} onCreate={(name) => void createFood(name)} />
          {error && <p role="alert" className="mt-2 text-alert">{error}</p>}

          {env.recipes.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 font-medium">{t('meals.form.recipes')}</p>
              <div className="flex flex-wrap gap-2">
                {env.recipes.slice(0, 8).map((r) => (
                  <button key={r.id} type="button" onClick={() => add({ kind: 'recipe', recipeId: r.id })}
                    className="min-h-11 rounded-full bg-white px-4 text-sm ring-1 ring-sand-200 active:bg-sage-50">
                    {r.kind === 'restaurant' ? '🍴' : '🏠'} {r.favorite ? '★ ' : ''}{r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Link to="/add/meal/recipes" className="mt-3 inline-flex min-h-11 items-center text-sage-700 underline">{t('meals.form.manageRecipes')}</Link>
        </Card>

        <MealAnalysisPanel analysis={analysis} ctx={ctx} />

        <Card>
          <label className="block">
            <span className="mb-1 block font-medium">{t('meals.form.note')}</span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant={favorite ? 'primary' : 'soft'} aria-pressed={favorite} onClick={() => setFavorite((f) => !f)}>{favorite ? '★' : '☆'} {t('meals.form.favorite')}</Button>
            <Button onClick={() => setRecipeDialog(true)} disabled={analysis.foods.length === 0}>{t('meals.form.saveAsRecipe')}</Button>
          </div>
        </Card>
      </div>

      <div className="sticky bottom-0 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-4 pb-4 pt-6">
        <button type="button" onClick={onSave}
          className="min-h-16 w-full rounded-3xl bg-sage-500 px-6 text-xl font-semibold text-white shadow-lg active:bg-sage-700">
          {t('meals.form.save')}
        </button>
      </div>

      {dialog && (
        <Modal title={t('meals.dialog.title')} onClose={() => setDialog(false)}>
          <p className="text-ink-soft">{t('meals.dialog.intro')}</p>
          <AlertsList alerts={blocking} ctx={ctx} />
          <div className="space-y-2">
            <Button variant="primary" className="w-full" onClick={removeOffending}>{t('meals.dialog.remove')}</Button>
            <Button className="w-full" onClick={() => void doSave([...new Set([...(initial?.acknowledgedAlerts ?? []), ...blocking.map(alertKey)])])}>{t('meals.dialog.keep')}</Button>
            <Button variant="ghost" className="w-full" onClick={() => setDialog(false)}>{t('meals.dialog.back')}</Button>
          </div>
        </Modal>
      )}

      {recipeDialog && (
        <RecipeFromMeal foodIds={analysis.foods.map((f) => f.id)} hasFree={items.some((i) => i.kind === 'free')} onClose={() => setRecipeDialog(false)} />
      )}
    </>
  )
}

/** Crée une recette à partir des ingrédients du repas en cours (maison ou restaurant). */
function RecipeFromMeal({ foodIds, hasFree, onClose }: { foodIds: string[]; hasFree: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [kind, setKind] = useState<RecipeKind>('home')
  const [place, setPlace] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const input = 'min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200'
  const save = async () => {
    if (!name.trim()) { setError(t('meals.recipe.needName')); return }
    await saveRecipe({ name, kind, place, items: foodIds.map((foodId) => ({ foodId })) })
    setDone(true)
  }
  return (
    <Modal title={t('meals.form.saveAsRecipe')} onClose={onClose}>
      {done ? (
        <>
          <p className="font-medium text-sage-700">✓ {t('meals.recipe.saved')}</p>
          <Button variant="primary" className="w-full" onClick={onClose}>OK</Button>
        </>
      ) : (
        <>
          <Segmented<RecipeKind> label={t('meals.recipe.title')} value={kind} onChange={setKind}
            options={[{ value: 'home', label: `🏠 ${t('meals.recipe.kind.home')}` }, { value: 'restaurant', label: `🍴 ${t('meals.recipe.kind.restaurant')}` }]} />
          <label className="block"><span className="mb-1 block font-medium">{t('meals.recipe.name')}</span>
            <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
          {kind === 'restaurant' && (
            <label className="block"><span className="mb-1 block font-medium">{t('meals.recipe.place')}</span>
              <input className={input} value={place} onChange={(e) => setPlace(e.target.value)} /></label>
          )}
          {kind === 'restaurant' && <p className="text-sm text-ink-soft">{t('meals.recipe.restaurantHint')}</p>}
          {hasFree && <p className="text-sm text-ink-soft">{t('meals.recipe.onlyFoods')}</p>}
          {error && <p role="alert" className="text-alert">{error}</p>}
          <div className="space-y-2">
            <Button variant="primary" className="w-full" onClick={() => void save()}>{t('meals.recipe.save')}</Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>{t('common.cancel')}</Button>
          </div>
        </>
      )}
    </Modal>
  )
}

/** Création (`/add/meal/new`) ou modification (`/add/meal/:id`) d'un repas. */
export function MealFormPage() {
  const { id } = useParams()
  const env = useMealEnv()
  const editing = id && id !== 'new' ? id : undefined
  const meal = useMeal(editing)
  if (!env || (editing && !meal)) return null
  return <MealForm key={meal?.id ?? 'new'} env={env} initial={meal} />
}
