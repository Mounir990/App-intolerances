import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui'
import { setDayCompleted, useCycleStarts, useDayCounts, useDayRecord } from '@/db/today'
import { useSettings } from '@/db/settings'
import { cycleInfo, type CyclePhase } from '@/domain/cycle'
import { todayKey } from '@/domain/time'
import { useLang } from '@/features/foods/shared'
import { CATEGORIES, CATEGORY_IDS, type CategoryId } from './categories'

const PHASE_BG: Record<CyclePhase, string> = {
  menstruation: 'bg-phase-menstrual', follicular: 'bg-phase-follicular', ovulation: 'bg-phase-ovulation',
  luteal: 'bg-phase-luteal', premenstrual: 'bg-phase-premenstrual',
}

/** Une catégorie : grosse carte colorée (couleur identique partout dans l'app). */
function CategoryCard({ id, count, wide }: { id: CategoryId; count: number; wide?: boolean }) {
  const { t } = useTranslation()
  const c = CATEGORIES[id]
  return (
    <Link to={`/add/${id}`}
      className={`flex min-h-32 flex-col justify-between gap-3 rounded-3xl p-5 transition-transform active:scale-[0.98] ${c.card} ${wide ? 'col-span-2 min-h-28' : ''}`}>
      <span className="flex items-center gap-2.5">
        <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${c.dot}`} aria-hidden="true" />
        <span className="text-xl font-semibold leading-tight">{t(`categories.${id}`)}</span>
      </span>
      <span className="flex items-end justify-between gap-2">
        <span className="min-w-0 text-[15px] leading-snug opacity-90">{count > 0 ? t('today.entries', { count }) : t('today.nothingYet')}</span>
        <span className="emoji-soft shrink-0 text-3xl leading-none" aria-hidden="true">{c.emoji}</span>
      </span>
    </Link>
  )
}

/** Écran « Aujourd'hui » : cartes par catégorie, saisie en un tap, bouton symptôme toujours visible. */
export function TodayPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const settings = useSettings()
  const date = todayKey()
  const counts = useDayCounts(date)
  const day = useDayRecord(date)
  const starts = useCycleStarts()

  // Raccourci d'appui long sur l'icône Android (manifest) : « Noter un symptôme ».
  useEffect(() => {
    if (params.get('quick') === 'symptom') navigate('/add/symptom', { replace: true })
  }, [params, navigate])

  if (!settings) return null
  const hidden = new Set(settings.hiddenCategories)
  const visible = CATEGORY_IDS.filter((id) => !hidden.has(id))
  const cycle = cycleInfo(date, starts.map((s) => ({ date: s.date, cycleLength: s.cycleLength })), settings)
  const rawDate = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  const dateLabel = rawDate.charAt(0).toUpperCase() + rawDate.slice(1)

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div>
          <h1 className="text-3xl font-semibold">{t('today.title')}</h1>
          <p className="mt-0.5 text-lg text-ink-soft">{dateLabel}</p>
        </div>
        <Link to="/calendar" aria-label={t('today.openCalendar')}
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-sage-700 ring-1 ring-sand-200 active:bg-sage-50">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" />
          </svg>
        </Link>
      </header>

      <div className="flex-1 space-y-4 px-4">
        <p className="text-ink-soft">{t('today.subtitle')}</p>

        {cycle && (
          <p className={`inline-flex flex-wrap items-center gap-x-2 rounded-2xl px-4 py-2.5 text-base ${PHASE_BG[cycle.phase]}`}>
            <strong className="font-semibold">{t('today.cycleDay', { day: cycle.cycleDay })}</strong>
            <span>· {t(`cycle.phase.${cycle.phase}`)} ({t('today.cycleEstimate')})</span>
          </p>
        )}

        {visible.length === 0 ? (
          <p className="rounded-3xl bg-white p-5 text-ink-soft ring-1 ring-sand-200">{t('today.allHidden')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visible.map((id, i) => (
              <CategoryCard key={id} id={id} count={counts[id]} wide={i === 0 && id === 'meal'} />
            ))}
          </div>
        )}

        <section className="rounded-3xl bg-white p-5 ring-1 ring-sand-200">
          <h2 className="text-lg font-semibold">{t('today.dayDone.title')}</h2>
          {day?.completed ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 font-medium text-sage-700"><span aria-hidden="true">✓</span>{t('today.dayDone.done')}</p>
              <Button variant="ghost" onClick={() => void setDayCompleted(date, false)}>{t('today.dayDone.reopen')}</Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-ink-soft">{t('today.dayDone.hint')}</p>
              <Button className="mt-3 w-full" onClick={() => void setDayCompleted(date, true)}>✓ {t('today.dayDone.button')}</Button>
            </>
          )}
        </section>
      </div>

      {/* Toujours visible, à portée du pouce, juste au-dessus de la barre de navigation. */}
      <div className="sticky bottom-0 mt-4 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-4 pb-4 pt-6">
        <Link to="/add/symptom"
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-3xl bg-sage-500 px-5 text-lg font-semibold text-white shadow-lg active:bg-sage-700">
          <span aria-hidden="true" className="text-2xl">＋</span>{t('today.noteNow')}
        </Link>
      </div>
    </div>
  )
}
