import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleChip } from '@/components/ui'
import { BODY_VIEWBOX, zonesOfView } from '@/domain/body'
import type { BodyView } from '@/domain/types'

export type Selected = { view: BodyView; zone: string }[]

// Silhouette schématique (volontairement simple et neutre). Même forme de face et de dos.
const SILHOUETTE = (
  <>
    <ellipse cx="100" cy="30" rx="20" ry="24" />
    <rect x="92" y="52" width="16" height="14" rx="5" />
    <path d="M60 66 Q100 56 140 66 L148 104 L146 202 L54 202 L52 104 Z" />
    <rect x="30" y="72" width="20" height="128" rx="10" />
    <rect x="150" y="72" width="20" height="128" rx="10" />
    <path d="M54 202 L98 202 L95 304 L92 410 L62 410 L58 304 Z" />
    <path d="M102 202 L146 202 L142 304 L138 410 L108 410 L105 304 Z" />
  </>
)

/**
 * Carte du corps cliquable (face / dos). Chaque zone est un bouton accessible ; une liste de choix
 * équivalente est proposée en dessous (plus facile à toucher sur les petites zones).
 * Côtés de la PERSONNE : de face, sa droite est à gauche de l'écran ; de dos, c'est l'inverse.
 */
export function BodyMap({ selected, onChange, region }: { selected: Selected; onChange: (s: Selected) => void; region?: 'pelvic' | 'leg' }) {
  const { t } = useTranslation()
  const [view, setView] = useState<BodyView>('front')
  const zones = zonesOfView(view)
  const isOn = (zone: string) => selected.some((s) => s.view === view && s.zone === zone)
  const toggle = (zone: string) =>
    onChange(isOn(zone) ? selected.filter((s) => !(s.view === view && s.zone === zone)) : [...selected, { view, zone }])
  const leftSide = view === 'front' ? 'D' : 'G'
  const rightSide = view === 'front' ? 'G' : 'D'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('sym.pain.map')}>
        {(['front', 'back'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} onClick={() => setView(v)}
            className={`min-h-12 rounded-2xl font-medium ring-1 ${view === v ? 'bg-sage-500 text-white ring-sage-500' : 'bg-white ring-sand-200'}`}>
            {t(`sym.pain.${v}`)}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${BODY_VIEWBOX.w} ${BODY_VIEWBOX.h}`} className="mx-auto block w-full max-w-[260px]" role="group" aria-label={t('sym.pain.map')}>
        <g fill="var(--color-sand-100)" stroke="var(--color-ink-soft)" strokeOpacity="0.5" strokeWidth="1.5">{SILHOUETTE}</g>
        <text x="10" y="14" fontSize="12" fill="var(--color-ink-soft)">{leftSide}</text>
        <text x="190" y="14" fontSize="12" fill="var(--color-ink-soft)" textAnchor="end">{rightSide}</text>
        {zones.map((z) => {
          const on = isOn(z.id)
          const dim = region && z.region !== region
          return (
            <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h} rx="6" role="button" tabIndex={0}
              aria-label={t(`bodyZone.${z.id}`)} aria-pressed={on}
              onClick={() => toggle(z.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(z.id) } }}
              fill={on ? 'var(--color-cat-gyne-fill)' : 'transparent'} fillOpacity={on ? 0.75 : 1}
              stroke={on ? 'var(--color-cat-gyne-ink)' : 'var(--color-ink-soft)'} strokeOpacity={on ? 1 : dim ? 0.2 : 0.45}
              strokeWidth={on ? 2 : 1} strokeDasharray={on ? undefined : '3 3'} style={{ cursor: 'pointer' }} />
          )
        })}
      </svg>

      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sage-700">{t('sym.pain.map')} — {t(`sym.pain.${view}`)}</summary>
        <div className="flex flex-wrap gap-2 pb-1">
          {zones.map((z) => <ToggleChip key={z.id} active={isOn(z.id)} onClick={() => toggle(z.id)}>{t(`bodyZone.${z.id}`)}</ToggleChip>)}
        </div>
      </details>
    </div>
  )
}
