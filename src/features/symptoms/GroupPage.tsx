import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui'
import { CATEGORY_OF_TABLE, deleteEntry, useEntriesOfDay } from '@/db/entries'
import { useSymptomCatalog, useSymptomUsage } from '@/db/symptoms'
import { rankByUsage } from '@/domain/symptoms'
import { todayKey } from '@/domain/time'
import { CATEGORIES, type CategoryId } from '@/features/today/categories'
import { describeEntry, editPath } from './entryLabel'

const CONTEXT_FORMS = [
  { kind: 'stress', emoji: '😣' }, { kind: 'sleep', emoji: '😴' }, { kind: 'activity', emoji: '🏃' }, { kind: 'medication', emoji: '💊' },
] as const

/**
 * Écran d'une catégorie (Digestif, Peau/ORL/autres, Gynécologie, Contexte) : ce qui est noté aujourd'hui
 * (modifiable, supprimable) et les symptômes à noter en un tap.
 */
export function GroupPage({ id }: { id: Exclude<CategoryId, 'meal'> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const cat = CATEGORIES[id]
  const catalog = useSymptomCatalog()
  const usage = useSymptomUsage()
  const entries = useEntriesOfDay(todayKey()).filter((e) => CATEGORY_OF_TABLE[e.table] === id)
  const symptoms = rankByUsage(catalog, usage).filter((s) => s.category === id)

  return (
    <>
      <PageHeader title={t(`categories.${id}`)} subtitle={t('sym.group.today')} />
      <div className="space-y-5 px-4 pb-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-sage-700">← {t('add.back')}</Link>

        {entries.length === 0 && <p className="text-ink-soft">{t('sym.group.none')}</p>}
        <ul className="space-y-2">
          {entries.map(({ table, entry }) => {
            const v = describeEntry(table, entry, catalog, t)
            return (
              <li key={entry.id} className={`flex items-center gap-2 rounded-2xl p-3 pl-4 ${cat.card}`}>
                <Link to={editPath(table, entry)} className="flex min-w-0 flex-1 items-center gap-3 py-1" aria-label={`${t('sym.group.edit')} ${v.title}`}>
                  <span className="text-2xl" aria-hidden="true">{v.emoji}</span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{v.time} · {v.title}</span>
                    {v.detail && <span className="block text-sm opacity-90">{v.detail}</span>}
                  </span>
                </Link>
                <button type="button" aria-label={`${t('sym.details.delete')} ${v.title}`}
                  onClick={() => { if (window.confirm(t('sym.details.deleteConfirm'))) void deleteEntry(table, entry.id) }}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl active:bg-black/10">🗑</button>
              </li>
            )
          })}
        </ul>

        {id === 'context' ? (
          <div className="grid grid-cols-2 gap-3">
            {CONTEXT_FORMS.map((f) => (
              <Link key={f.kind} to={`/add/context/${f.kind}`}
                className={`flex min-h-24 flex-col justify-between rounded-3xl p-4 font-semibold active:opacity-80 ${cat.card}`}>
                <span className="text-3xl" aria-hidden="true">{f.emoji}</span>{t(`sym.context.${f.kind}`)}
              </Link>
            ))}
          </div>
        ) : (
          <section>
            <h2 className="mb-2 font-semibold">{t('sym.group.add')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {symptoms.map((s) => (
                <button key={s.id} type="button" onClick={() => navigate(s.special ?? `/add/symptom?symptom=${encodeURIComponent(s.id)}`)}
                  className={`flex min-h-16 items-center gap-2.5 rounded-2xl px-4 py-2 text-left font-medium active:opacity-80 ${cat.card}`}>
                  <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
                  <span className="leading-tight">{s.custom ? s.name : t(`symptoms.${s.id}`)}</span>
                </button>
              ))}
              <Link to={`/add/symptom?other=${id}`}
                className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-white px-4 font-medium text-sage-700 ring-2 ring-sage-200 active:bg-sage-50">
                ＋ {t('sym.quick.other')}
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  )
}
