import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, PageHeader } from '@/components/ui'
import { DEFAULT_SEED_SOURCES } from '@/data/seedMeta'
import { useFoodCatalog } from '@/db/foods'
import { useSettings } from '@/db/settings'
import { buildContext, scanText } from '@/domain/detection'
import { AlertsList, DisclaimerNote, FoodInfoCard } from './shared'

/** Colle une liste d'ingrédients : allergènes déclarés, allergènes personnels et aliments de la base. */
export function ScanPage() {
  const { t } = useTranslation()
  const catalog = useFoodCatalog()
  const settings = useSettings()
  const [text, setText] = useState('')

  const ctx = useMemo(
    () => (catalog && settings
      ? buildContext({
        foods: catalog, watchedFlags: settings.profile.watchedFlags,
        derivatives: DEFAULT_SEED_SOURCES.derivatives, excludedFromTextDetection: DEFAULT_SEED_SOURCES.excludedFromTextDetection,
      })
      : null),
    [catalog, settings],
  )
  const scan = useMemo(() => (ctx && text.trim() ? scanText(text, ctx) : null), [ctx, text])
  if (!ctx) return null

  const found = scan && (scan.alerts.length || scan.declared.length || scan.foods.length || scan.personal.length)
  const personalFoods = scan?.personal.map((h) => ({ hit: h, food: ctx.byId.get(h.key)! })).filter((x) => x.food) ?? []
  const needsReview = scan?.foods.some((h) => {
    const f = ctx.byId.get(h.key)
    return f && (f.histamineReliability === 'approximative' || f.fodmapReliability === 'approximative')
  })

  return (
    <>
      <PageHeader title={t('foods.scanPage.title')} subtitle={t('foods.scanPage.intro')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/settings/foods" className="inline-flex min-h-11 items-center text-sage-700">← {t('foods.sheet.back')}</Link>
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('foods.scanPage.placeholder')}
          aria-label={t('foods.scanPage.title')} className="w-full rounded-3xl bg-white p-4 ring-1 ring-sand-200 placeholder:text-ink-soft/60" />

        {scan && !found && <p className="text-ink-soft">{t('foods.scanPage.nothing')}</p>}
        {scan && <AlertsList alerts={scan.alerts} ctx={ctx} />}

        {scan && scan.declared.length > 0 && (
          <Card title={t('detect.declared')}>
            <div className="flex flex-wrap gap-2">
              {scan.declared.map((d) => (
                <span key={d.key} className="rounded-full bg-sand-100 px-3 py-1.5 text-sm">
                  {t(`enum.flag.${d.key}`)}{d.trace ? ` · ${t('detect.trace')}` : ''}
                </span>
              ))}
            </div>
          </Card>
        )}

        {scan && (scan.foods.length > 0 || personalFoods.length > 0) && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t('detect.foods')}</h2>
            {personalFoods.map(({ hit, food }) => <FoodInfoCard key={food.id} food={food} matched={hit.matched} trace={hit.trace} />)}
            {scan.foods.map((h) => <FoodInfoCard key={h.key} food={ctx.byId.get(h.key)!} matched={h.matched} trace={h.trace} />)}
            {needsReview && <p className="text-sm text-warn">{t('detect.needsReview')}</p>}
          </section>
        )}
        <DisclaimerNote />
      </div>
    </>
  )
}
