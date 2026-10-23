import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { searchFoods, scanText, type DetectionContext } from '@/domain/detection'
import type { Lang } from '@/domain/types'
import { foodName, foodOtherName } from '@/features/foods/shared'

/**
 * Recherche d'aliments avec saisie semi-automatique (FR + ES, sans accent).
 * Les allergènes personnels ne sont JAMAIS proposés ; s'ils sont tapés, le texte libre
 * garde l'alerte active. On ne peut pas non plus « créer » un aliment qui en contient un.
 */
export function FoodSearch({ ctx, lang, onPickFood, onFreeText, onCreate }: {
  ctx: DetectionContext
  lang: Lang
  onPickFood: (foodId: string) => void
  /** Absent : le texte libre n'est pas proposé (éditeur de recette : il faut des ingrédients). */
  onFreeText?: (text: string) => void
  onCreate: (name: string) => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const query = q.trim()
  const results = useMemo(() => searchFoods(query, ctx, 8), [query, ctx])
  const blocked = useMemo(() => query.length > 0 && scanText(query, ctx).personal.length > 0, [query, ctx])

  const reset = () => setQ('')
  return (
    <div className="space-y-2">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('meals.search.placeholder')}
        aria-label={t('meals.search.placeholder')} autoComplete="off" enterKeyHint="done"
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) { onPickFood(results[0].id); reset() } }}
        className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg ring-1 ring-sand-200 placeholder:text-ink-soft/60" />
      {query && (
        <ul className="space-y-1.5">
          {results.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => { onPickFood(f.id); reset() }}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl bg-white px-4 text-left ring-1 ring-sand-200 active:bg-sage-50">
                <span>
                  <span className="font-medium">{foodName(f, lang)}</span>
                  {foodOtherName(f, lang) !== foodName(f, lang) && <span className="ml-2 text-sm text-ink-soft">{foodOtherName(f, lang)}</span>}
                </span>
                <span className="shrink-0 text-2xl text-sage-700" aria-hidden="true">＋</span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="px-1 text-ink-soft">{t('meals.search.noResult')}</li>}
          {onFreeText && (
            <li>
              <button type="button" onClick={() => { onFreeText(query); reset() }}
                className="min-h-12 w-full rounded-2xl bg-sand-100 px-4 text-left text-sm active:bg-sage-50">
                {t('meals.search.free', { q: query })}
              </button>
            </li>
          )}
          <li>
            {blocked ? (
              <p className="rounded-2xl bg-alert-bg px-4 py-3 text-sm text-alert">{t('meals.search.blockedCreate', { q: query })}</p>
            ) : (
              <button type="button" onClick={() => { onCreate(query); reset() }}
                className="min-h-12 w-full rounded-2xl bg-sage-100 px-4 text-left text-sm font-medium text-sage-700 active:bg-sage-200">
                ＋ {t('meals.search.create', { q: query })}
              </button>
            )}
          </li>
        </ul>
      )}
    </div>
  )
}
