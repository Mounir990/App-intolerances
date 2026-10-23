import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, PageHeader } from '@/components/ui'
import { deleteMeal, setMealFavorite, useMealsOfDay } from '@/db/meals'
import { analyzeMeal } from '@/domain/detection'
import { timeKey, todayKey } from '@/domain/time'
import { itemName, useMealEnv } from './useMealEnv'

/** Repas du jour : modifier, supprimer, favori, ajouter. Ouvert depuis la carte « Repas » de l'écran Aujourd'hui. */
export function MealsTodayPage() {
  const { t } = useTranslation()
  const env = useMealEnv()
  const meals = useMealsOfDay(todayKey())
  const location = useLocation()
  const saved = (location.state as { saved?: boolean } | null)?.saved

  if (!env) return null
  return (
    <>
      <PageHeader title={t('categories.meal')} subtitle={t('meals.subtitle')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-sage-700">← {t('add.back')}</Link>
        {saved && <p role="status" className="rounded-2xl bg-sage-100 px-4 py-3 font-medium text-sage-700">✓ {t('meals.saved')}</p>}

        <Link to="/add/meal/new"
          className="flex min-h-16 items-center justify-center gap-2 rounded-3xl bg-sage-500 px-6 text-xl font-semibold text-white shadow active:bg-sage-700">
          <span aria-hidden="true">＋</span>{t('meals.add')}
        </Link>

        {meals.length === 0 && <p className="text-ink-soft">{t('meals.empty')}</p>}

        <ul className="space-y-3">
          {meals.map((m) => {
            const a = analyzeMeal(m.items, env.ctx)
            return (
              <li key={m.id} className="rounded-3xl bg-cat-meal-tint p-4 text-cat-meal-ink">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/add/meal/${m.id}`} className="min-w-0 flex-1" aria-label={`${t('meals.list.edit')} ${t(`meals.type.${m.type}`)}`}>
                    <p className="text-lg font-semibold">{timeKey(m.ts)} · {t(`meals.type.${m.type}`)}</p>
                    <p className="mt-0.5">{m.items.map((i) => itemName(i, env, t('meals.form.deletedRecipe'))).join(', ')}</p>
                  </Link>
                  <button type="button" aria-pressed={!!m.favorite} aria-label={t(m.favorite ? 'meals.list.unstar' : 'meals.list.star')}
                    onClick={() => void setMealFavorite(m.id, !m.favorite)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl active:bg-black/10">
                    {m.favorite ? '★' : '☆'}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {a.labels.flags.slice(0, 5).map((f) => <span key={f} className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs">{t(`enum.flag.${f}`)}</span>)}
                  {a.unanalyzed.length > 0 && <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-xs">{t('meals.analysis.unanalyzed')}</span>}
                  {m.acknowledgedAlerts?.length ? <span className="rounded-full bg-alert-bg px-2.5 py-0.5 text-xs text-alert">⚠ {t('meals.list.ack')}</span> : null}
                </div>
                <div className="mt-2 flex gap-2">
                  <Link to={`/add/meal/${m.id}`} className="inline-flex min-h-11 items-center rounded-full bg-white/60 px-4 text-sm font-medium active:bg-white/80">{t('meals.list.edit')}</Link>
                  <Button variant="ghost" className="min-h-11 px-4 text-sm"
                    onClick={() => { if (window.confirm(t('meals.list.deleteConfirm'))) void deleteMeal(m.id) }}>{t('meals.list.delete')}</Button>
                </div>
              </li>
            )
          })}
        </ul>
        <Link to="/add/meal/recipes" className="inline-flex min-h-11 items-center text-sage-700 underline">{t('meals.form.manageRecipes')}</Link>
      </div>
    </>
  )
}
