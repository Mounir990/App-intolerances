import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmergencyBanner, FormShell, IntensityScale, WhenField } from '@/components/forms'
import { Button, Card, Segmented, Stepper } from '@/components/ui'
import { deleteEntry, saveEntry, useEntry, type AnyEntry, type EntryTable } from '@/db/entries'
import { useCycleStarts } from '@/db/today'
import { useSettings } from '@/db/settings'
import { ABDOMEN_ZONES, BRISTOL_TYPES, bristolGroup } from '@/domain/body'
import { cycleInfo } from '@/domain/cycle'
import { needsEmergencyMessage } from '@/domain/emergency'
import { dateKey, toTs, todayKey } from '@/domain/time'
import type { BodyView } from '@/domain/types'
import { useUsualMedications } from '@/db/entries'
import { BodyMap, type Selected } from './BodyMap'

/** Charge l'entrée à modifier (si l'adresse en contient une) avant d'afficher le formulaire. */
function WithEntry({ table, render }: { table: EntryTable; render: (initial?: AnyEntry) => ReactNode }) {
  const { id } = useParams()
  const entry = useEntry(table, id)
  if (id && !entry) return null
  return <>{render(entry)}</>
}

/** Enregistre, supprime, puis revient à l'écran de la catégorie. */
function useSaver(table: EntryTable, category: string, initial?: AnyEntry) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const back = `/add/${category}`
  return {
    back,
    save: async (fields: Record<string, unknown> & { ts: number }) => {
      await saveEntry(table, fields, initial?.id)
      navigate(back, { replace: true })
    },
    remove: initial ? async () => {
      if (window.confirm(t('sym.details.deleteConfirm'))) { await deleteEntry(table, initial.id); navigate(back, { replace: true }) }
    } : undefined,
  }
}

const noteField = (value: string, set: (v: string) => void, label: string) => (
  <label className="block"><span className="mb-1 block font-medium">{label}</span>
    <textarea rows={2} value={value} onChange={(e) => set(e.target.value)} className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200" /></label>
)

// ───────────────────────── Douleur pelvienne / à la jambe ─────────────────────────

const PAIN_TYPES = ['cramping', 'stabbing', 'burning', 'pressure', 'dull', 'other'] as const
type PainType = (typeof PAIN_TYPES)[number]

function PainForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const saver = useSaver('pain', 'gyne', initial)
  const [region, setRegion] = useState<'pelvic' | 'leg'>((initial?.region as 'pelvic' | 'leg') ?? (params.get('region') === 'leg' ? 'leg' : 'pelvic'))
  const [type, setType] = useState<PainType | undefined>(initial?.painType as PainType | undefined)
  const [intensity, setIntensity] = useState<number | undefined>(initial?.intensity as number | undefined)
  const [zones, setZones] = useState<Selected>((initial?.zones as Selected | undefined) ?? [])
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [note, setNote] = useState((initial?.note as string | undefined) ?? '')
  const [error, setError] = useState('')
  const id = region === 'leg' ? 'legPain' : 'pelvicPain'

  const save = () => {
    if (intensity === undefined) { setError(t('sym.errors.intensity')); return }
    void saver.save({ ts, region, painType: type, intensity, zones, note: note.trim() || undefined })
  }
  return (
    <FormShell title={t(`symptoms.${id}`)} backTo={saver.back} backLabel={t('categories.gyne')} saveLabel={t('sym.pain.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      <Segmented<'pelvic' | 'leg'> label={t('sym.pain.region')} value={region} onChange={setRegion} optionClass="min-w-[9rem]"
        options={[{ value: 'pelvic', label: t('symptoms.pelvicPain') }, { value: 'leg', label: t('symptoms.legPain') }]} />
      {needsEmergencyMessage(id, intensity) && <EmergencyBanner />}
      <Card title={t('sym.pain.intensity')} hint={t('sym.scale10')}>
        <IntensityScale max={10} value={intensity} onChange={setIntensity} tone="gyne" label={t('sym.pain.intensity')} />
      </Card>
      <Card title={t('sym.pain.type')}>
        <Segmented<PainType> label={t('sym.pain.type')} value={type ?? ('' as PainType)} onChange={setType} optionClass="min-w-[7rem]"
          options={PAIN_TYPES.map((x) => ({ value: x, label: t(`sym.pain.types.${x}`) }))} />
      </Card>
      <Card title={t('sym.pain.map')}>
        <BodyMap selected={zones} onChange={setZones} region={region} />
        <p className="mt-3 text-sm font-medium">{t('sym.pain.selected')}</p>
        {zones.length === 0
          ? <p className="text-sm text-ink-soft">{t('sym.pain.none')}</p>
          : <ul className="mt-1 flex flex-wrap gap-1.5">{zones.map((z) => (
            <li key={`${z.view}-${z.zone}`} className="rounded-full bg-cat-gyne-tint px-3 py-1 text-sm text-cat-gyne-ink">
              {t(`bodyZone.${z.zone}`)} <span className="opacity-70">({t(`sym.pain.${z.view as BodyView}`)})</span>
            </li>))}</ul>}
      </Card>
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
      {noteField(note, setNote, t('sym.details.note'))}
    </FormShell>
  )
}
export const PainFormPage = () => <WithEntry table="pain" render={(e) => <PainForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Saignement ─────────────────────────

const BLEEDING = ['spotting', 'light', 'medium', 'heavy', 'clots'] as const
type Bleeding = (typeof BLEEDING)[number]

function BleedingForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const saver = useSaver('gyne', 'gyne', initial)
  const [type, setType] = useState<Bleeding | undefined>(initial?.bleedingType as Bleeding | undefined)
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [note, setNote] = useState((initial?.note as string | undefined) ?? '')
  const [error, setError] = useState('')
  const save = () => {
    if (!type) { setError(t('sym.errors.type')); return }
    void saver.save({ ts, kind: 'bleeding', bleedingType: type, note: note.trim() || undefined })
  }
  return (
    <FormShell title={t('sym.bleeding.title')} backTo={saver.back} backLabel={t('categories.gyne')} saveLabel={t('sym.bleeding.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      <Card title={t('sym.bleeding.type')}>
        <Segmented<Bleeding> label={t('sym.bleeding.type')} value={type ?? ('' as Bleeding)} onChange={setType} optionClass="min-w-[7rem]"
          options={BLEEDING.map((x) => ({ value: x, label: t(`sym.bleeding.types.${x}`) }))} />
      </Card>
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
      {noteField(note, setNote, t('sym.details.note'))}
    </FormShell>
  )
}
export const BleedingFormPage = () => <WithEntry table="gyne" render={(e) => <BleedingForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Début des règles (jour 1) ─────────────────────────

function PeriodForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const settings = useSettings()
  const starts = useCycleStarts()
  const saver = useSaver('cycleStarts', 'gyne', initial)
  const [date, setDate] = useState(initial?.date ? String(initial.date) : todayKey())
  const [length, setLength] = useState<string>(initial?.cycleLength ? String(initial.cycleLength) : '')
  const [saved, setSaved] = useState(false)

  const save = async () => {
    // Un seul début de règles par jour : on met à jour celui qui existe déjà plutôt que d'en dupliquer un.
    const sameDay = starts.find((s) => s.date === date && s.id !== initial?.id)
    const len = Number(length)
    await saveEntry('cycleStarts', { ts: toTs(date, '12:00'), cycleLength: len >= 15 && len <= 60 ? len : undefined }, initial?.id ?? sameDay?.id)
    setSaved(true)
  }

  if (saved && settings) {
    const info = cycleInfo(todayKey(), starts.map((s) => ({ date: s.date, cycleLength: s.cycleLength })), settings)
    return (
      <FormShell title={t('sym.period.title')} backTo={saver.back} backLabel={t('categories.gyne')} saveLabel="OK" onSave={() => navigate(saver.back, { replace: true })}>
        <p role="status" className="rounded-3xl bg-cat-gyne-tint p-5 text-lg font-semibold text-cat-gyne-ink">✓ {t('sym.period.saved')}</p>
        {info && <p className="text-ink-soft">{t('sym.period.result', { day: info.cycleDay, phase: t(`cycle.phase.${info.phase}`) })}</p>}
      </FormShell>
    )
  }
  return (
    <FormShell title={t('sym.period.title')} backTo={saver.back} backLabel={t('categories.gyne')} saveLabel={t('sym.period.save')}
      onSave={() => void save()} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      <p className="text-ink-soft">{t('sym.period.hint')}</p>
      <Card title={t('sym.period.date')}>
        <input type="date" value={date} max={dateKey(Date.now())} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('sym.period.date')}
          className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg ring-1 ring-sand-200" />
      </Card>
      <Card title={t('sym.period.length')}>
        <input type="number" inputMode="numeric" min={15} max={60} value={length} onChange={(e) => setLength(e.target.value)} placeholder="28"
          aria-label={t('sym.period.length')} className="min-h-12 w-32 rounded-2xl bg-white px-4 text-lg ring-1 ring-sand-200" />
      </Card>
    </FormShell>
  )
}
export const PeriodFormPage = () => <WithEntry table="cycleStarts" render={(e) => <PeriodForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Douleur / crampe abdominale ─────────────────────────

function CrampForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const saver = useSaver('digestive', 'digestive', initial)
  const [location, setLocation] = useState<string | undefined>(initial?.location as string | undefined)
  const [intensity, setIntensity] = useState<number | undefined>(initial?.intensity as number | undefined)
  const [relief, setRelief] = useState<'yes' | 'no' | 'unknown'>(initial?.reliefByToilet === true ? 'yes' : initial?.reliefByToilet === false ? 'no' : 'unknown')
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [note, setNote] = useState((initial?.note as string | undefined) ?? '')
  const [error, setError] = useState('')
  const save = () => {
    if (intensity === undefined) { setError(t('sym.errors.intensity')); return }
    void saver.save({ ts, kind: 'pain', intensity, location, reliefByToilet: relief === 'unknown' ? undefined : relief === 'yes', note: note.trim() || undefined })
  }
  return (
    <FormShell title={t('sym.cramp.title')} backTo={saver.back} backLabel={t('categories.digestive')} saveLabel={t('sym.cramp.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      {needsEmergencyMessage('pain', intensity) && <EmergencyBanner />}
      <Card title={t('sym.cramp.intensity')}><IntensityScale max={5} value={intensity} onChange={setIntensity} tone="digestive" label={t('sym.cramp.intensity')} /></Card>
      <Card title={t('sym.cramp.where')}>
        <Segmented<string> label={t('sym.cramp.where')} value={location ?? ''} onChange={setLocation} optionClass="min-w-[9rem]"
          options={ABDOMEN_ZONES.map((z) => ({ value: z, label: t(`bodyZone.${z}`) }))} />
      </Card>
      <Card title={t('sym.cramp.relief')}>
        <Segmented<'yes' | 'no' | 'unknown'> label={t('sym.cramp.relief')} value={relief} onChange={setRelief}
          options={[{ value: 'yes', label: t('sym.yes') }, { value: 'no', label: t('sym.no') }, { value: 'unknown', label: t('sym.unknownShort') }]} />
      </Card>
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
      {noteField(note, setNote, t('sym.details.note'))}
    </FormShell>
  )
}
export const CrampFormPage = () => <WithEntry table="digestive" render={(e) => <CrampForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Selles (échelle de Bristol) ─────────────────────────

function StoolForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const saver = useSaver('digestive', 'digestive', initial)
  const [bristol, setBristol] = useState<number | undefined>(initial?.bristol as number | undefined)
  const [count, setCount] = useState((initial?.count as number | undefined) ?? 1)
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [error, setError] = useState('')
  const save = () => {
    if (!bristol) { setError(t('sym.errors.bristol')); return }
    void saver.save({ ts, kind: 'stool', bristol, count })
  }
  return (
    <FormShell title={t('sym.stool.title')} backTo={saver.back} backLabel={t('categories.digestive')} saveLabel={t('sym.stool.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      <Card title={t('sym.stool.bristol')}>
        <div role="radiogroup" aria-label={t('sym.stool.bristol')} className="space-y-2">
          {BRISTOL_TYPES.map((n) => (
            <button key={n} type="button" role="radio" aria-checked={bristol === n} onClick={() => setBristol(n)}
              className={`flex min-h-16 w-full items-center gap-4 rounded-2xl bg-cat-digestive-tint px-4 text-left text-cat-digestive-ink active:opacity-80 ${bristol === n ? 'ring-4 ring-ink' : 'ring-1 ring-sand-200'}`}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-xl font-bold text-ink">{n}</span>
              <span><span className="block text-sm opacity-80">{t(`sym.stool.groups.${bristolGroup(n)}`)}</span>{t(`sym.stool.desc.${n}`)}</span>
            </button>
          ))}
        </div>
      </Card>
      <Card><Stepper label={t('sym.stool.count')} value={count} min={1} max={15} onChange={setCount} /></Card>
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
    </FormShell>
  )
}
export const StoolFormPage = () => <WithEntry table="digestive" render={(e) => <StoolForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Réaction immédiate après un repas ─────────────────────────

const MINUTES = [5, 10, 15, 30, 45, 60] as const

function ReactionForm({ initial }: { initial?: AnyEntry }) {
  const { t } = useTranslation()
  const saver = useSaver('digestive', 'digestive', initial)
  const [reaction, setReaction] = useState<'urgency' | 'diarrhea' | undefined>(initial?.reaction as 'urgency' | 'diarrhea' | undefined)
  const [minutes, setMinutes] = useState<number | undefined>(initial?.minutesAfterMeal as number | undefined)
  const [intensity, setIntensity] = useState<number | undefined>(initial?.intensity as number | undefined)
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [error, setError] = useState('')
  const save = () => {
    if (!reaction) { setError(t('sym.errors.type')); return }
    void saver.save({ ts, kind: 'immediateReaction', reaction, minutesAfterMeal: minutes, intensity })
  }
  return (
    <FormShell title={t('sym.reaction.title')} backTo={saver.back} backLabel={t('categories.digestive')} saveLabel={t('sym.reaction.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      <p className="text-ink-soft">{t('sym.reaction.hint')}</p>
      <Card title={t('sym.reaction.kind')}>
        <Segmented<'urgency' | 'diarrhea'> label={t('sym.reaction.kind')} value={reaction ?? ('' as 'urgency')} onChange={setReaction}
          options={[{ value: 'urgency', label: t('sym.reaction.urgency') }, { value: 'diarrhea', label: t('sym.reaction.diarrhea') }]} />
      </Card>
      <Card title={t('sym.reaction.minutes')}>
        <Segmented<string> label={t('sym.reaction.minutes')} value={minutes ? String(minutes) : ''} onChange={(v) => setMinutes(Number(v))} optionClass="min-w-[4rem]"
          options={MINUTES.map((m) => ({ value: String(m), label: `${m}` }))} />
      </Card>
      <Card title={t('sym.details.intensity')}><IntensityScale max={5} value={intensity} onChange={setIntensity} tone="digestive" label={t('sym.details.intensity')} /></Card>
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
    </FormShell>
  )
}
export const ReactionFormPage = () => <WithEntry table="digestive" render={(e) => <ReactionForm key={e?.id ?? 'new'} initial={e} />} />

// ───────────────────────── Contexte : stress, sommeil, activité, médicaments ─────────────────────────

const ACTIVITIES = ['walk', 'run', 'yoga', 'gym', 'swim', 'bike', 'other'] as const

function HoursStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <div className="flex items-center gap-2" role="group" aria-label={label}>
        <Button aria-label="−" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 0.5))} className="w-12 px-0 text-2xl">−</Button>
        <span className="min-w-16 text-center text-lg tabular-nums">{value} h</span>
        <Button aria-label="+" disabled={value >= 16} onClick={() => onChange(Math.min(16, value + 0.5))} className="w-12 px-0 text-2xl">+</Button>
      </div>
    </div>
  )
}

function ContextForm({ kind, initial }: { kind: 'stress' | 'sleep' | 'activity' | 'medication'; initial?: AnyEntry }) {
  const { t } = useTranslation()
  const saver = useSaver('context', 'context', initial)
  const usual = useUsualMedications()
  const [ts, setTs] = useState((initial?.ts as number | undefined) ?? Date.now())
  const [stress, setStress] = useState<number | undefined>(initial?.stress as number | undefined)
  const [hours, setHours] = useState((initial?.sleepHours as number | undefined) ?? 7)
  const [quality, setQuality] = useState<number | undefined>(initial?.sleepQuality as number | undefined)
  const [wakeups, setWakeups] = useState((initial?.painWakeups as number | undefined) ?? 0)
  const [activity, setActivity] = useState<string | undefined>(initial?.activity as string | undefined)
  const [minutes, setMinutes] = useState<number | undefined>(initial?.activityMinutes as number | undefined)
  const [med, setMed] = useState((initial?.medName as string | undefined) ?? '')
  const [error, setError] = useState('')

  const save = () => {
    if (kind === 'stress') {
      if (!stress) { setError(t('sym.errors.intensity')); return }
      void saver.save({ ts, kind, stress })
    } else if (kind === 'sleep') void saver.save({ ts, kind, sleepHours: hours, sleepQuality: quality, painWakeups: wakeups })
    else if (kind === 'activity') {
      if (!activity) { setError(t('sym.errors.type')); return }
      void saver.save({ ts, kind, activity, activityMinutes: minutes })
    } else {
      if (!med.trim()) { setError(t('sym.context.needName')); return }
      void saver.save({ ts, kind, medName: med.trim() })
    }
  }

  return (
    <FormShell title={t(`sym.context.${kind}`)} backTo={saver.back} backLabel={t('categories.context')} saveLabel={t('sym.context.save')} error={error}
      onSave={save} onDelete={saver.remove && (() => void saver.remove!())} deleteLabel={t('sym.details.delete')}>
      {kind === 'stress' && (
        <Card title={t('sym.context.stress')} hint={t('sym.context.stressHint')}>
          <IntensityScale max={5} value={stress} onChange={setStress} tone="context" label={t('sym.context.stress')} />
        </Card>
      )}
      {kind === 'sleep' && (
        <>
          <Card><HoursStepper label={t('sym.context.hours')} value={hours} onChange={setHours} /></Card>
          <Card title={t('sym.context.quality')} hint={t('sym.context.qualityHint')}>
            <IntensityScale max={5} value={quality} onChange={setQuality} tone="context" label={t('sym.context.quality')} />
          </Card>
          <Card><Stepper label={t('sym.context.wakeups')} value={wakeups} min={0} max={15} onChange={setWakeups} /></Card>
        </>
      )}
      {kind === 'activity' && (
        <>
          <Card title={t('sym.context.activityName')}>
            <Segmented<string> label={t('sym.context.activityName')} value={activity ?? ''} onChange={setActivity} optionClass="min-w-[6rem]"
              options={ACTIVITIES.map((a) => ({ value: a, label: t(`sym.context.activities.${a}`) }))} />
          </Card>
          <Card title={t('sym.context.activityMinutes')}>
            <Segmented<string> label={t('sym.context.activityMinutes')} value={minutes ? String(minutes) : ''} onChange={(v) => setMinutes(Number(v))} optionClass="min-w-[4.5rem]"
              options={[15, 30, 45, 60, 90].map((m) => ({ value: String(m), label: `${m} min` }))} />
          </Card>
        </>
      )}
      {kind === 'medication' && (
        <Card title={t('sym.context.medName')}>
          <input value={med} onChange={(e) => setMed(e.target.value)} aria-label={t('sym.context.medName')} autoComplete="off"
            className="min-h-14 w-full rounded-2xl bg-white px-4 text-lg ring-1 ring-sand-200" />
          {usual.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-medium">{t('sym.context.usual')}</p>
              <div className="flex flex-wrap gap-2">
                {usual.slice(0, 8).map((m) => (
                  <button key={m} type="button" onClick={() => setMed(m)}
                    className="min-h-11 rounded-full bg-cat-context-tint px-4 text-sm text-cat-context-ink active:opacity-80">{m}</button>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
      <WhenField ts={ts} onChange={setTs} label={kind === 'medication' ? t('sym.context.medTime') : t('sym.details.when')} />
    </FormShell>
  )
}

export function ContextFormPage() {
  const { kind } = useParams()
  if (!['stress', 'sleep', 'activity', 'medication'].includes(kind ?? '')) {
    return <Link to="/add/context" className="m-4 inline-block text-sage-700">←</Link>
  }
  return <WithEntry table="context" render={(e) => <ContextForm key={e?.id ?? 'new'} kind={kind as 'stress'} initial={e} />} />
}
