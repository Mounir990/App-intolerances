import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader, ToggleChip } from '@/components/ui'
import type { RecipeKind } from '@/domain/types'
import { useMealEnv } from './useMealEnv'

/** Liste des recettes : maison ou restaurant, favorites d'abord. */
export function RecipesPage() {
  const { t } = useTranslation()
  const env = useMealEnv()
  const [filter, setFilter] = useState<'all' | RecipeKind>('all')
  if (!env) return null
  const shown = env.recipes.filter((r) => filter === 'all' || r.kind === filter)
  return (
    <>
      <PageHeader title={t('meals.recipe.title')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/add/meal" className="inline-flex min-h-11 items-center text-sage-700">← {t('meals.subtitle')}</Link>
        <Link to="/add/meal/recipes/new"
          className="flex min-h-14 items-center justify-center gap-2 rounded-3xl bg-sage-500 px-6 text-lg font-semibold text-white active:bg-sage-700">
          ＋ {t('meals.recipe.new')}
        </Link>
        <div className="flex flex-wrap gap-2">
          <ToggleChip active={filter === 'all'} onClick={() => setFilter('all')}>{t('meals.recipe.filterAll')}</ToggleChip>
          <ToggleChip active={filter === 'home'} onClick={() => setFilter('home')}>🏠 {t('meals.recipe.kind.home')}</ToggleChip>
          <ToggleChip active={filter === 'restaurant'} onClick={() => setFilter('restaurant')}>🍴 {t('meals.recipe.kind.restaurant')}</ToggleChip>
        </div>
        {env.recipes.length === 0 && (
          <div className="rounded-3xl bg-white p-5 ring-1 ring-sand-200">
            <p className="font-medium">{t('meals.recipe.empty')}</p>
            <p className="mt-1 text-ink-soft">{t('meals.recipe.emptyHint')}</p>
          </div>
        )}
        <ul className="space-y-2">
          {shown.map((r) => (
            <li key={r.id}>
              <Link to={`/add/meal/recipes/${r.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl bg-cat-meal-tint px-4 py-3 text-cat-meal-ink active:opacity-80">
                <span className="text-2xl" aria-hidden="true">{r.kind === 'restaurant' ? '🍴' : '🏠'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{r.favorite ? '★ ' : ''}{r.name}</span>
                  <span className="block text-sm opacity-85">
                    {t(`meals.recipe.kind.${r.kind}`)}{r.place ? ` · ${r.place}` : ''} · {t('meals.recipe.count', { count: r.items.length })}
                    {r.kind === 'restaurant' ? ` · ${t('meals.recipe.estimated')}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
