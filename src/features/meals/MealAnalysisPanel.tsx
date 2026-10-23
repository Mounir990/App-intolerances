import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui'
import type { MealAnalysis } from '@/domain/detection'
import type { DetectionContext } from '@/domain/detection'
import { AlertsList, CompleteFoodLink, FoodInfoCard, LevelPill, foodName, useLang } from '@/features/foods/shared'

/**
 * Étiquettes détectées dans un repas, en direct : allergènes/familles, histamine, FODMAP.
 * Un « ? » reste un « ? » : un niveau n'est donné que parmi les aliments CONNUS, et le panneau dit
 * quand des aliments inconnus rendent le résultat incomplet.
 */
export function MealAnalysisPanel({ analysis, ctx }: { analysis: MealAnalysis; ctx: DetectionContext }) {
  const { t } = useTranslation()
  const lang = useLang()
  const { labels } = analysis
  const hasFoods = analysis.foods.length > 0
  const names = (ids: string[]) => ids.map((id) => ctx.byId.get(id)).filter(Boolean).map((f) => foodName(f!, lang)).join(', ')

  return (
    <div className="space-y-3">
      <AlertsList alerts={analysis.alerts} ctx={ctx} />

      <Card title={t('meals.analysis.title')}>
        {!hasFoods && analysis.unanalyzed.length === 0 && <p className="text-ink-soft">{t('meals.analysis.none')}</p>}

        {hasFoods && (
          <div className="space-y-3">
            {(labels.flags.length > 0 || labels.lactose) && (
              <div>
                <p className="mb-1.5 text-sm font-medium">{t('meals.analysis.allergens')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {labels.flags.map((f) => <span key={f} className="rounded-full bg-sand-100 px-3 py-1 text-sm">{t(`enum.flag.${f}`)}</span>)}
                  {labels.lactose && <span className="rounded-full bg-sand-100 px-3 py-1 text-sm">{t('meals.analysis.lactose')}</span>}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium">{t('meals.analysis.histamine')}</span>
              {labels.histamine.max ? <LevelPill kind="histamine" level={labels.histamine.max} /> : <><LevelPill kind="histamine" level="inconnu" /><span className="text-sm text-ink-soft">{t('meals.analysis.unknownAll')}</span></>}
            </div>
            {labels.histamine.liberators.length > 0 && <p className="text-sm text-ink-soft">{t('meals.analysis.liberators')} : {names(labels.histamine.liberators)}</p>}
            {labels.histamine.dao.length > 0 && <p className="text-sm text-ink-soft">{t('meals.analysis.dao')} : {names(labels.histamine.dao)}</p>}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium">{t('meals.analysis.fodmap')}</span>
              {labels.fodmap.max ? <LevelPill kind="fodmap" level={labels.fodmap.max} /> : <><LevelPill kind="fodmap" level="inconnu" /><span className="text-sm text-ink-soft">{t('meals.analysis.unknownAll')}</span></>}
            </div>
            {labels.fodmap.types.length > 0 && (
              <p className="text-sm text-ink-soft">{t('meals.analysis.types')} : {labels.fodmap.types.map((x) => t(`enum.fodmapType.${x}`, { defaultValue: x })).join(', ')}</p>
            )}

            {(labels.histamine.hasUnknown || labels.fodmap.hasUnknown) && <p className="text-sm text-warn">{t('meals.analysis.incomplete')}</p>}
          </div>
        )}

        {analysis.unanalyzed.length > 0 && (
          <div className="mt-3 rounded-2xl bg-sand-100 p-3">
            <p className="text-sm font-medium">{t('meals.analysis.unanalyzed')} : {analysis.unanalyzed.join(', ')}</p>
            <p className="mt-1 text-sm text-ink-soft">{t('meals.analysis.unanalyzedHint')}</p>
          </div>
        )}
        {analysis.restaurantRecipes.length > 0 && <p className="mt-3 text-sm text-warn">{t('meals.analysis.restaurant')}</p>}
        {analysis.needsReview && <p className="mt-3 text-sm text-warn">{t('detect.needsReview')}</p>}

        {analysis.toComplete.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-sm font-medium">{t('meals.analysis.toComplete')}</p>
            <div className="flex flex-wrap gap-2">
              {analysis.toComplete.map((id) => (
                <span key={id} className="inline-flex flex-col gap-1">
                  <span className="text-sm text-ink-soft">{foodName(ctx.byId.get(id)!, lang)}</span>
                  <CompleteFoodLink foodId={id} />
                </span>
              ))}
            </div>
          </div>
        )}

        {hasFoods && (
          <details className="mt-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sage-700">{t('meals.analysis.detail')}</summary>
            <div className="space-y-2">{analysis.foods.map((f) => <FoodInfoCard key={f.id} food={f} />)}</div>
          </details>
        )}
      </Card>
    </div>
  )
}
