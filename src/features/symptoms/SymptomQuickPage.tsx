import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmergencyBanner, IntensityScale } from '@/components/forms'
import { Button, Modal, PageHeader, Segmented } from '@/components/ui'
import { deleteEntry } from '@/db/entries'
import { addCustomSymptom, logSymptom, useSymptomCatalog, useSymptomUsage } from '@/db/symptoms'
import { needsEmergencyMessage } from '@/domain/emergency'
import { rankByUsage, type ResolvedSymptom, type SymptomCategory } from '@/domain/symptoms'
import { timeKey } from '@/domain/time'
import { CATEGORIES, type CategoryId } from '@/features/today/categories'
import { symptomName } from './entryLabel'

const GROUPS: { category: SymptomCategory; id: CategoryId }[] = [
  { category: 'digestive', id: 'digestive' }, { category: 'skinOrl', id: 'skinOrl' }, { category: 'gyne', id: 'gyne' },
]
const EMOJI_SUGGESTIONS = ['🦶', '🦵', '🤒', '😖', '🥶', '😮‍💨', '💓', '🧠', '🫨', '😴', '🦷', '👁️', '💥', '🌡️', '🫥', '✨']

/** Pastille de symptôme : émoji + nom, grande zone tactile. La couleur est celle de la catégorie. */
function SymptomChip({ s, onClick, t }: { s: ResolvedSymptom; onClick: () => void; t: (k: string) => string }) {
  const cat = CATEGORIES[s.category === 'skinOrl' ? 'skinOrl' : s.category]
  return (
    <button type="button" onClick={onClick}
      className={`flex min-h-16 items-center gap-2.5 rounded-2xl px-4 py-2 text-left font-medium active:opacity-80 ${cat.card}`}>
      <span className="text-2xl" aria-hidden="true">{s.emoji}</span>
      <span className="min-w-0 break-words leading-tight">{s.custom ? s.name : t(`symptoms.${s.id}`)}</span>
    </button>
  )
}

function OtherSymptomSheet({ initialCategory, onClose, onCreated }: {
  initialCategory: SymptomCategory; onClose: () => void; onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [category, setCategory] = useState<SymptomCategory>(initialCategory)
  const [error, setError] = useState('')
  const save = async () => {
    if (!name.trim()) { setError(t('sym.other.needName')); return }
    onCreated(await addCustomSymptom({ name, emoji, category }))
  }
  return (
    <Modal title={t('sym.other.title')} onClose={onClose}>
      <label className="block"><span className="mb-1 block font-medium">{t('sym.other.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus className="min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200" /></label>
      <div>
        <span className="mb-1 block font-medium">{t('sym.other.emoji')}</span>
        <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} aria-label={t('sym.other.emoji')}
          className="min-h-12 w-24 rounded-2xl bg-white px-4 text-center text-2xl ring-1 ring-sand-200" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EMOJI_SUGGESTIONS.map((e) => (
            <button key={e} type="button" onClick={() => setEmoji(e)} aria-label={e}
              className="grid h-11 w-11 place-items-center rounded-xl bg-sand-100 text-xl active:bg-sage-100">{e}</button>
          ))}
        </div>
      </div>
      <div>
        <span className="mb-1 block font-medium">{t('sym.other.category')}</span>
        <Segmented<SymptomCategory> label={t('sym.other.category')} value={category} onChange={setCategory} optionClass="min-w-[7rem]"
          options={GROUPS.map((g) => ({ value: g.category, label: t(`categories.${g.id}`) }))} />
      </div>
      <p className="text-sm text-ink-soft">{t('sym.other.hint')}</p>
      {error && <p role="alert" className="text-alert">{error}</p>}
      <div className="space-y-2">
        <Button variant="primary" className="w-full" onClick={() => void save()}>{t('sym.other.save')}</Button>
        <Button variant="ghost" className="w-full" onClick={onClose}>{t('common.cancel')}</Button>
      </div>
    </Modal>
  )
}

interface Saved { symptom: ResolvedSymptom; intensity: number; ts: number; table: 'digestive' | 'extra' | 'gyne'; id: string }

/**
 * « Noter un symptôme maintenant » : deux taps (symptôme, puis intensité). C'est enregistré aussitôt,
 * à l'instant présent ; l'heure précise, la durée et la note se complètent ensuite (facultatif).
 */
function QuickFlow() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const catalog = useSymptomCatalog()
  const usage = useSymptomUsage()
  const [picked, setPicked] = useState<string | null>(params.get('symptom'))
  const [saved, setSaved] = useState<Saved | null>(null)
  const [other, setOther] = useState<SymptomCategory | null>(params.get('other') as SymptomCategory | null)
  const [error, setError] = useState('')

  const visible = useMemo(() => rankByUsage(catalog, usage), [catalog, usage])
  const frequent = visible.filter((s) => (usage.get(s.id) ?? 0) > 0 && !s.special).slice(0, 6)
  const symptom = picked ? catalog.find((s) => s.id === picked) : undefined

  const choose = (s: ResolvedSymptom) => {
    if (s.special) navigate(s.special)
    else { setPicked(s.id); setError('') }
  }
  const record = async (intensity: number) => {
    if (!symptom) return
    try {
      const r = await logSymptom(symptom, { intensity })
      setSaved({ symptom, intensity, ts: Date.now(), ...r })
      setPicked(null)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  const undo = async () => {
    if (saved) await deleteEntry(saved.table, saved.id)
    setSaved(null)
  }

  // ── Étape 3 : c'est noté
  if (saved) {
    const urgent = needsEmergencyMessage(saved.symptom.id, saved.intensity)
    return (
      <>
        <PageHeader title={t('sym.quick.title')} />
        <div className="space-y-4 px-4 pb-8">
          <div role="status" className="rounded-3xl bg-sage-100 p-5 text-sage-700">
            <p className="text-lg font-semibold">✓ {t('sym.quick.saved', { time: timeKey(saved.ts) })}</p>
            <p className="mt-1 text-xl">
              <span aria-hidden="true">{saved.symptom.emoji}</span> {symptomName(saved.symptom.id, catalog, t)} · {saved.intensity}/{saved.symptom.scale}
            </p>
          </div>
          {urgent && <EmergencyBanner />}
          <Link to={`/add/entry/${saved.table}/${saved.id}`}
            className="flex min-h-14 items-center justify-center rounded-2xl bg-white px-5 text-lg font-medium ring-1 ring-sand-200 active:bg-sage-50">
            {t('sym.quick.addDetails')}
          </Link>
          <Button variant="primary" className="min-h-14 w-full text-lg" onClick={() => { setSaved(null) }}>{t('sym.quick.another')}</Button>
          <Link to="/" className="flex min-h-12 items-center justify-center rounded-2xl text-sage-700 active:bg-sage-50">{t('sym.quick.done')}</Link>
          <Button variant="ghost" className="w-full" onClick={() => void undo()}>{t('sym.quick.undo')}</Button>
        </div>
      </>
    )
  }

  // ── Étape 2 : l'intensité
  if (symptom) {
    const cat = CATEGORIES[symptom.category === 'skinOrl' ? 'skinOrl' : symptom.category]
    return (
      <>
        <PageHeader title={t('sym.quick.howStrong')} />
        <div className="space-y-4 px-4 pb-8">
          <button type="button" onClick={() => setPicked(null)} className="inline-flex min-h-11 items-center text-sage-700">← {t('sym.quick.back')}</button>
          <p className={`flex items-center gap-3 rounded-3xl p-5 text-xl font-semibold ${cat.card}`}>
            <span className="text-3xl" aria-hidden="true">{symptom.emoji}</span>{symptomName(symptom.id, catalog, t)}
          </p>
          {symptom.urgent && <EmergencyBanner />}
          <IntensityScale max={symptom.scale} tone={cat.tone} label={t('sym.quick.howStrong')} onChange={(n) => void record(n)} />
          {symptom.scale === 10 && <p className="text-center text-sm text-ink-soft">{t('sym.scale10')}</p>}
          {error && <p role="alert" className="text-alert">{error}</p>}
        </div>
      </>
    )
  }

  // ── Étape 1 : le symptôme
  return (
    <>
      <PageHeader title={t('sym.quick.title')} subtitle={t('sym.quick.hint')} />
      <div className="space-y-5 px-4 pb-8">
        <Link to="/" className="inline-flex min-h-11 items-center text-sage-700">← {t('add.back')}</Link>
        {frequent.length > 0 && (
          <section>
            <h2 className="mb-2 font-semibold">{t('sym.quick.recent')}</h2>
            <div className="grid grid-cols-2 gap-2">{frequent.map((s) => <SymptomChip key={s.id} s={s} t={t} onClick={() => choose(s)} />)}</div>
          </section>
        )}
        {GROUPS.map((g) => {
          const items = visible.filter((s) => s.category === g.category)
          return (
            <section key={g.id}>
              <h2 className="mb-2 font-semibold">{t(`categories.${g.id}`)}</h2>
              <div className="grid grid-cols-2 gap-2">{items.map((s) => <SymptomChip key={s.id} s={s} t={t} onClick={() => choose(s)} />)}</div>
            </section>
          )
        })}
        <button type="button" onClick={() => setOther('skinOrl')}
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-lg font-medium text-sage-700 ring-2 ring-sage-200 active:bg-sage-50">
          <span aria-hidden="true">＋</span>{t('sym.quick.other')}
        </button>
      </div>
      {other && (
        <OtherSymptomSheet initialCategory={other} onClose={() => setOther(null)}
          onCreated={(id) => { setOther(null); setPicked(id) }} />
      )}
    </>
  )
}

/**
 * Chaque ouverture de la page repart de zéro (clé = navigation en cours) : sinon, rouvrir « Noter un symptôme »
 * depuis le raccourci Android alors que la page est déjà affichée garderait l'écran de confirmation précédent.
 */
export function SymptomQuickPage() {
  const location = useLocation()
  return <QuickFlow key={location.key} />
}
