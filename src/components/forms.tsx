import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, PageHeader } from '@/components/ui'
import { EMERGENCY_NUMBER } from '@/domain/emergency'
import { dateKey, timeKey, toTs } from '@/domain/time'
import type { Tone } from '@/features/today/categories'

/**
 * Échelle d'intensité à gros boutons (5 ou 10 niveaux). Une seule teinte par catégorie, du pâle au soutenu :
 * jamais rouge/vert (pas de jugement). Les chiffres sont gros pour rester lisibles les jours de brouillard.
 */
export function IntensityScale({ max, value, onChange, tone, label }: {
  max: 5 | 10; value?: number; onChange: (n: number) => void; tone: Tone; label: string
}) {
  const { t } = useTranslation()
  const pct = (n: number) => (max === 5 ? [14, 30, 48, 64, 80][n - 1] : 10 + Math.round(((n - 1) * 70) / 9))
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-2">
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n}
          aria-label={max === 5 ? `${n} — ${t(`sym.scale5.${n}`)}` : String(n)} onClick={() => onChange(n)}
          style={{ backgroundColor: `color-mix(in srgb, var(--color-cat-${tone}-fill) ${pct(n)}%, var(--color-white))` }}
          className={`flex min-h-16 flex-col items-center justify-center rounded-2xl text-2xl font-bold text-ink transition-transform active:scale-95 ${
            value === n ? 'ring-4 ring-ink' : 'ring-1 ring-sand-200'}`}>
          {n}
          {max === 5 && <span className="text-[11px] font-medium leading-tight">{t(`sym.scale5.${n}`)}</span>}
        </button>
      ))}
    </div>
  )
}

/** Date + heure précises d'un événement : « maintenant » par défaut, −15 / +15 min, ou choix libre. */
export function WhenField({ ts, onChange, label }: { ts: number; onChange: (ts: number) => void; label: string }) {
  const { t } = useTranslation()
  const date = dateKey(ts)
  const time = timeKey(ts)
  return (
    <div>
      <p className="mb-2 font-medium">{label}</p>
      <div className="flex items-center gap-2">
        <Button aria-label="−15 min" onClick={() => onChange(ts - 15 * 60_000)} className="shrink-0 px-3">−15</Button>
        <input type="time" value={time} aria-label={t('meals.form.time')}
          onChange={(e) => e.target.value && onChange(toTs(date, e.target.value))}
          className="min-h-14 min-w-0 flex-1 rounded-2xl bg-white px-2 text-center text-xl font-semibold ring-1 ring-sand-200" />
        <Button aria-label="+15 min" onClick={() => onChange(ts + 15 * 60_000)} className="shrink-0 px-3">+15</Button>
      </div>
      <input type="date" value={date} aria-label={t('meals.form.date')}
        onChange={(e) => e.target.value && onChange(toTs(e.target.value, time))}
        className="mt-3 min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200" />
    </div>
  )
}

/** Message d'urgence : clair, calme, jamais alarmiste. Le lien « Appeler le 112 » ouvre le composeur du téléphone. */
export function EmergencyBanner() {
  const { t } = useTranslation()
  return (
    <section role="alert" className="space-y-3 rounded-3xl bg-alert-bg p-5 text-alert ring-1 ring-alert/30">
      <h2 className="text-lg font-semibold">{t('sym.emergency.title')}</h2>
      <p className="text-ink">{t('sym.emergency.text')}</p>
      <a href={`tel:${EMERGENCY_NUMBER}`}
        className="flex min-h-14 items-center justify-center rounded-2xl bg-alert px-5 text-lg font-semibold text-sand-50 active:opacity-90">
        📞 {t('sym.emergency.call')}
      </a>
      <p className="text-sm text-ink-soft">{t('sym.emergency.hint')}</p>
    </section>
  )
}

/** Coque d'un formulaire : titre, retour, contenu, et barre d'enregistrement toujours à portée du pouce. */
export function FormShell({ title, backTo, backLabel, children, saveLabel, onSave, onDelete, deleteLabel, error }: {
  title: string
  backTo: string
  backLabel: string
  children: ReactNode
  saveLabel: string
  onSave: () => void
  onDelete?: () => void
  deleteLabel?: string
  error?: string
}) {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <>
      <PageHeader title={title} />
      <div className="space-y-4 px-4 pb-4">
        <Link to={backTo} className="inline-flex min-h-11 items-center text-sage-700">← {backLabel}</Link>
        {children}
        {error && <p role="alert" className="text-alert">{error}</p>}
        {onDelete && <Button variant="danger" className="w-full" onClick={onDelete}>{deleteLabel}</Button>}
      </div>
      <div className="sticky bottom-0 bg-gradient-to-t from-sand-50 via-sand-50 to-transparent px-4 pb-4 pt-6">
        <button type="button" onClick={onSave}
          className="min-h-16 w-full rounded-3xl bg-sage-500 px-6 text-xl font-semibold text-white shadow-lg active:bg-sage-700">
          {saveLabel}
        </button>
      </div>
    </>
  )
}
