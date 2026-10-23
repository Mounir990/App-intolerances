import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { DeclaredAllergen, DetectionContext, FoodAlert } from '@/domain/detection'
import type { EffectiveFood, FodmapLevel, HistamineLevel, Reliability, SourceRecord } from '@/domain/foods'
import type { Lang } from '@/domain/types'

export const foodName = (f: EffectiveFood, lang: Lang) => (lang === 'fr' ? f.nameFr : f.nameEs)
export const foodOtherName = (f: EffectiveFood, lang: Lang) => (lang === 'fr' ? f.nameEs : f.nameFr)

export function useLang(): Lang {
  const { i18n } = useTranslation()
  return (i18n.language === 'fr' ? 'fr' : 'es') as Lang
}

/** Badge de fiabilité PAR INFORMATION. « Vérifiée par moi » a un style distinct. */
export function ReliabilityBadge({ value }: { value: Reliability }) {
  const { t } = useTranslation()
  const style: Record<Reliability, string> = {
    confirmee: 'bg-sage-100 text-sage-700',
    approximative: 'border border-dashed border-warn bg-warn-bg text-warn',
    inconnue: 'bg-sand-100 text-ink-soft',
    utilisateur: 'bg-user-bg text-user ring-1 ring-user/30',
  }
  const mark: Record<Reliability, string> = { confirmee: '●', approximative: '≈', inconnue: '?', utilisateur: '✓' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${style[value]}`}>
      <span aria-hidden="true">{mark[value]}</span>{t(`enum.reliability.${value}`)}
    </span>
  )
}

/** Niveau d'histamine ou de FODMAP. « inconnu » s'affiche « ? » (jamais « non », jamais « bas »). */
export function LevelPill({ kind, level }: { kind: 'histamine' | 'fodmap'; level: HistamineLevel | FodmapLevel }) {
  const { t } = useTranslation()
  const unknown = level === 'inconnu'
  const tone =
    unknown ? 'bg-sand-100 text-ink-soft'
      : level === 'bas' || level === 'bas_selon_portion' ? 'bg-sage-100 text-sage-700'
        : level === 'moyen' ? 'bg-warn-bg text-warn' : 'bg-high-bg text-high'
  return (
    <span className={`inline-flex min-h-7 min-w-7 items-center justify-center rounded-full px-3 text-sm font-semibold ${tone}`}
      aria-label={unknown ? t('enum.unknownLabel') : undefined}>
      {t(`enum.${kind}.${level}`)}
    </span>
  )
}

/** Infobulle adaptée au tactile : un bouton ⓘ qui déplie le texte (le survol n'existe pas sur mobile). */
export function Info({ text, label }: { text: string; label: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <>
      <button type="button" title={text} aria-expanded={open} aria-label={`${label} — ${open ? t('detect.close') : t('detect.more')}`}
        onClick={() => setOpen((o) => !o)}
        className="grid h-8 w-8 place-items-center rounded-full text-sage-700 ring-1 ring-sage-200 active:bg-sage-100">ⓘ</button>
      {open && <p className="basis-full rounded-xl bg-sand-100 p-3 text-sm text-ink-soft">{text}</p>}
    </>
  )
}

export function DisclaimerNote() {
  const { t } = useTranslation()
  return <p className="rounded-2xl bg-sand-100 p-3 text-sm text-ink-soft">{t('disclaimer.food')}</p>
}

/** Raccourci vers la fiche d'un aliment dont une valeur est « ? ». */
export function CompleteFoodLink({ foodId }: { foodId: string }) {
  const { t } = useTranslation()
  return (
    <Link to={`/settings/foods/${foodId}`}
      className="inline-flex min-h-11 items-center rounded-full bg-user-bg px-4 text-sm font-medium text-user active:opacity-80">
      ✎ {t('detect.complete')}
    </Link>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-24 shrink-0 text-sm text-ink-soft">{label}</span>
      {children}
    </div>
  )
}

/** Fiche d'information d'un aliment détecté : histamine / FODMAP avec badge de fiabilité et détail en infobulle. */
export function FoodInfoCard({ food, matched, trace }: { food: EffectiveFood; matched?: string; trace?: boolean }) {
  const { t } = useTranslation()
  const lang = useLang()
  const histDetail = [food.histamineDetail, food.otherAmines && food.otherAmines !== '—' ? food.otherAmines : ''].filter(Boolean).join(' · ')
  const fodDetail = [food.fodmapPortion, food.fodmapTypes.length ? food.fodmapTypes.join(', ') : ''].filter(Boolean).join(' · ')
  return (
    <article className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-sand-200">
      <header className="flex flex-wrap items-baseline gap-x-2">
        <h3 className="font-semibold">{foodName(food, lang)}</h3>
        {matched && <span className="text-sm text-ink-soft">{t('detect.matched', { matched })}{trace ? ` · ${t('detect.trace')}` : ''}</span>}
      </header>
      <Row label={t('detect.histamine')}>
        <LevelPill kind="histamine" level={food.histamineLevel} />
        <ReliabilityBadge value={food.histamineReliability} />
        <Info text={histDetail} label={t('detect.histamine')} />
      </Row>
      <Row label={t('detect.liberator')}>
        <span className="text-sm font-medium">{t(`enum.liberator.${food.liberator}`)}</span>
        {food.dao !== 'non' && <span className="text-sm text-ink-soft">· {t('detect.dao')} : {t(`enum.dao.${food.dao}`)}</span>}
      </Row>
      <Row label={t('detect.fodmap')}>
        <LevelPill kind="fodmap" level={food.fodmapLevel} />
        <ReliabilityBadge value={food.fodmapReliability} />
        <Info text={fodDetail} label={t('detect.fodmap')} />
      </Row>
      {food.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {food.flags.map((f) => (
            <span key={f} className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs text-ink-soft">{t(`enum.flag.${f}`)}</span>
          ))}
        </div>
      )}
      {food.needsCompletion && (
        <div className="space-y-1.5 pt-1">
          <p className="text-sm text-ink-soft">{t('detect.incomplete')}</p>
          <CompleteFoodLink foodId={food.id} />
        </div>
      )}
    </article>
  )
}

/** Clé de traduction et paramètres du message d'une alerte (une clé distincte par niveau de gravité). */
export function alertMessage(a: FoodAlert, name: string, family: string): { key: string; params: Record<string, string> } {
  switch (a.kind) {
    case 'personal': return { key: 'detect.personal', params: { name } }
    case 'cross_latex': return { key: 'detect.cross', params: { name } }
    case 'cross_latex_weak': return { key: 'detect.crossWeak', params: { name } }
    case 'watched':
      return name
        ? { key: 'detect.watched', params: { name, family } }
        : { key: 'detect.watchedText', params: { matched: a.matched ?? '', family } }
  }
}

const ALERT_STYLE = {
  personal: 'bg-alert-bg text-alert ring-1 ring-alert/30',
  cross_latex: 'bg-high-bg text-high ring-1 ring-high/20',
  // Alerte douce : volontairement bleutée et sans icône, pour ne pas être confondue avec les alertes fortes.
  cross_latex_weak: 'bg-mist-100 text-ink-soft ring-1 ring-mist-500/30',
  watched: 'bg-warn-bg text-warn',
} as const

/** Alertes : rouge = allergène confirmé ; orange = réactivité croisée ; sable = famille surveillée. */
export function AlertsList({ alerts, ctx }: { alerts: FoodAlert[]; ctx: DetectionContext }) {
  const { t } = useTranslation()
  const lang = useLang()
  if (alerts.length === 0) return null
  return (
    <section aria-label={t('detect.alertsTitle')} className="space-y-2">
      {alerts.map((a, i) => {
        const food = a.foodId ? ctx.byId.get(a.foodId) : undefined
        const name = food ? foodName(food, lang) : ''
        const family = a.flag ? t(`enum.flag.${a.flag as DeclaredAllergen}`) : ''
        const { key, params } = alertMessage(a, name, family)
        const text = t(key, params)
        return (
          <div key={`${a.kind}-${a.foodId ?? a.flag}-${i}`} role={a.kind === 'personal' ? 'alert' : 'status'}
            className={`rounded-2xl p-4 ${ALERT_STYLE[a.kind]}`}>
            <p className={a.kind === 'personal' ? 'font-semibold' : ''}>
              {a.kind === 'personal' ? '⚠ ' : a.kind === 'cross_latex_weak' ? 'ⓘ ' : ''}{text}{a.trace ? ` (${t('detect.trace')})` : ''}
            </p>
            {a.via === 'text' && a.matched && a.kind !== 'watched' && (
              <p className="mt-1 text-sm opacity-80">{t('detect.viaText', { matched: a.matched })}</p>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Une source de la base (S1…) ou « Ma source » : le code est un lien qui ouvre la page dans le navigateur. */
export function SourceList({ ids, sources }: { ids: string[]; sources: Map<string, SourceRecord> }) {
  const { t } = useTranslation()
  const lang = useLang()
  if (ids.length === 0) return null
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const src = sources.get(id)
          const label = id.startsWith('user:') ? '✎' : id
          return src?.url ? (
            <a key={id} href={src.url} target="_blank" rel="noopener noreferrer" title={src.title}
              className="inline-flex min-h-10 items-center rounded-full bg-sage-50 px-3 text-sm font-medium text-sage-700 ring-1 ring-sage-200 active:bg-sage-100">
              {label} ↗
            </a>
          ) : (
            <span key={id} title={src?.title} className="inline-flex min-h-10 items-center rounded-full bg-sand-100 px-3 text-sm text-ink-soft">{label}</span>
          )
        })}
      </div>
      <ul className="space-y-0.5 text-sm text-ink-soft">
        {ids.map((id) => {
          const src = sources.get(id)
          if (!src) return <li key={id}>{id}</li>
          const desc = lang === 'fr' ? src.descFr : src.descEs
          return <li key={id}><strong className="font-medium text-ink">{id.startsWith('user:') ? t('foods.sheet.mySourceShort') : id}</strong> — {src.title}{desc ? `, ${desc}` : ''}</li>
        })}
      </ul>
    </div>
  )
}
