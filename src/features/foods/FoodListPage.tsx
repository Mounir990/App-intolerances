import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, PageHeader, ToggleChip } from '@/components/ui'
import { useFoodCatalog, useSeedReport } from '@/db/foods'
import { normalize } from '@/domain/text'
import { exportEffectiveCsv } from '@/domain/seedCsv'
import type { EffectiveFood } from '@/domain/foods'
import { LevelPill, ReliabilityBadge, foodName, foodOtherName, useLang } from './shared'

type Filter = 'all' | 'toComplete' | 'approximate' | 'mine' | 'alerts'

const FILTERS: Record<Filter, (f: EffectiveFood) => boolean> = {
  all: () => true,
  toComplete: (f) => f.needsCompletion,
  approximate: (f) => f.histamineReliability === 'approximative' || f.fodmapReliability === 'approximative',
  mine: (f) => f.origin === 'custom',
  alerts: (f) => f.personalAlert !== '',
}

function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Réglages › Base d'aliments : liste filtrable, compteur « à compléter », ajout, export CSV. */
export function FoodListPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const catalog = useFoodCatalog()
  const report = useSeedReport()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  const categories = useMemo(() => [...new Set((catalog ?? []).map((f) => f.category))].sort((a, b) => a.localeCompare(b, lang)), [catalog, lang])
  const toComplete = useMemo(() => (catalog ?? []).filter((f) => f.needsCompletion).length, [catalog])

  const shown = useMemo(() => {
    const q = normalize(query)
    return (catalog ?? [])
      .filter(FILTERS[filter])
      .filter((f) => !category || f.category === category)
      .filter((f) => !q || normalize(`${f.nameFr} ${f.nameEs} ${f.aliases.join(' ')}`).includes(q))
      .sort((a, b) => foodName(a, lang).localeCompare(foodName(b, lang), lang))
  }, [catalog, query, category, filter, lang])

  if (!catalog) return null

  return (
    <>
      <PageHeader title={t('foods.title')} subtitle={t('foods.subtitle')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/settings" className="inline-flex min-h-11 items-center text-sage-700">← {t('settings.title')}</Link>

        <p className="rounded-2xl bg-user-bg px-4 py-3 font-medium text-user" role="status">
          {t('foods.toCompleteCount', { count: toComplete })}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Link to="/settings/foods/new" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-sage-500 px-4 text-center font-medium text-white active:bg-sage-700">
            + {t('foods.add')}
          </Link>
          <Link to="/settings/foods/scan" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-sage-100 px-4 text-center font-medium text-sage-700 active:bg-sage-200">
            {t('foods.scan')}
          </Link>
        </div>

        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('foods.search')} aria-label={t('foods.search')}
          className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200 placeholder:text-ink-soft/60" />

        <div className="flex flex-wrap gap-2">
          {(Object.keys(FILTERS) as Filter[]).map((k) => (
            <ToggleChip key={k} active={filter === k} onClick={() => setFilter(k)}>{t(`foods.filter.${k}`)}</ToggleChip>
          ))}
        </div>

        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t('foods.category')}
          className="min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200">
          <option value="">{t('foods.allCategories')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <p className="text-sm text-ink-soft">{t('foods.shown', { count: shown.length })}</p>
        {shown.length === 0 && <p className="text-ink-soft">{t('foods.empty')}</p>}

        <ul className="space-y-2">
          {shown.map((f) => (
            <li key={f.id}>
              <Link to={`/settings/foods/${f.id}`} className="block rounded-2xl bg-white p-4 ring-1 ring-sand-200 active:bg-sage-50">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{foodName(f, lang)}</span>
                  <span className="text-sm text-ink-soft">{foodOtherName(f, lang) !== foodName(f, lang) ? foodOtherName(f, lang) : ''}</span>
                  {f.personalAlert && <span className="rounded-full bg-alert-bg px-2 py-0.5 text-xs font-medium text-alert">⚠ {t('foods.personalBadge')}</span>}
                  {f.origin === 'custom' && <span className="rounded-full bg-user-bg px-2 py-0.5 text-xs font-medium text-user">{t('foods.mineBadge')}</span>}
                </div>
                <p className="text-xs text-ink-soft">{f.category}</p>
                <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1.5">
                  <span className="text-xs text-ink-soft">{t('foods.histamineShort')}</span>
                  <span className="flex flex-wrap items-center gap-1.5"><LevelPill kind="histamine" level={f.histamineLevel} /><ReliabilityBadge value={f.histamineReliability} /></span>
                  <span className="text-xs text-ink-soft">{t('foods.fodmapShort')}</span>
                  <span className="flex flex-wrap items-center gap-1.5"><LevelPill kind="fodmap" level={f.fodmapLevel} /><ReliabilityBadge value={f.fodmapReliability} /></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <Card hint={t('foods.exportHint')}>
          <Button className="w-full" onClick={() => download(`base_aliments_histamine_fodmap_${new Date().toISOString().slice(0, 10)}.csv`, exportEffectiveCsv(catalog))}>
            ⬇ {t('foods.exportCsv')}
          </Button>
        </Card>

        {report && (
          <Card title={t('foods.import.title')}>
            <details>
              <summary className="min-h-11 cursor-pointer py-2">
                {t('foods.import.summary', { imported: report.imported, rejected: report.rejected.length, warnings: report.warnings.length })}
              </summary>
              {report.rejected.length + report.warnings.length === 0 && <p className="text-ink-soft">{t('foods.import.none')}</p>}
              <ul className="space-y-1 text-sm text-ink-soft">
                {report.rejected.map((r) => <li key={`r${r.line}`}>✖ {t('foods.import.line', { line: r.line })} ({r.id ?? '?'}) : {r.reasons.join(' ; ')}</li>)}
                {report.warnings.map((w, i) => <li key={`w${i}`}>⚠ {t('foods.import.line', { line: w.line })} ({w.id ?? '?'}) : {w.message}</li>)}
              </ul>
            </details>
          </Card>
        )}
      </div>
    </>
  )
}
