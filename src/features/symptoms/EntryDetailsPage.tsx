import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EmergencyBanner, FormShell, IntensityScale, WhenField } from '@/components/forms'
import { Segmented } from '@/components/ui'
import { CATEGORY_OF_TABLE, deleteEntry, saveEntry, useEntry, type EntryTable } from '@/db/entries'
import { useSymptomCatalog } from '@/db/symptoms'
import { needsEmergencyMessage } from '@/domain/emergency'
import { CATEGORIES } from '@/features/today/categories'
import { symptomName } from './entryLabel'

const DURATIONS = [
  { value: 'none', min: undefined, key: 'unknown' }, { value: '5', min: 5, key: 'm5' }, { value: '15', min: 15, key: 'm15' },
  { value: '30', min: 30, key: 'm30' }, { value: '60', min: 60, key: 'h1' }, { value: '120', min: 120, key: 'h2' }, { value: '1440', min: 1440, key: 'day' },
] as const

/**
 * Détails FACULTATIFS d'un symptôme simple (digestif, peau/ORL/autres, gynéco) : heure précise, intensité,
 * durée, note. Ouvert après un enregistrement rapide, ou pour modifier une entrée.
 */
export function EntryDetailsPage() {
  const { table = 'digestive', id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const catalog = useSymptomCatalog()
  const entry = useEntry(table as EntryTable, id)
  const [ts, setTs] = useState<number | null>(null)
  const [intensity, setIntensity] = useState<number | undefined>()
  const [duration, setDuration] = useState<string>('none')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!entry) return
    setTs(entry.ts)
    setIntensity(typeof entry.intensity === 'number' ? entry.intensity : undefined)
    setDuration(entry.durationMin ? String(entry.durationMin) : 'none')
    setNote(typeof entry.note === 'string' ? entry.note : '')
  }, [entry])

  if (!entry || ts === null) return null
  const kind = String(entry.kind)
  const symptom = catalog.find((s) => s.id === kind)
  const cat = CATEGORIES[CATEGORY_OF_TABLE[table as EntryTable]]
  const back = `/add/${cat.id}`

  const save = async () => {
    const durationMin = DURATIONS.find((d) => d.value === duration)?.min
    await saveEntry(table as EntryTable, { ...entry, ts, intensity, durationMin, note: note.trim() || undefined }, entry.id)
    navigate(back, { replace: true })
  }
  const remove = async () => {
    if (window.confirm(t('sym.details.deleteConfirm'))) { await deleteEntry(table as EntryTable, entry.id); navigate(back, { replace: true }) }
  }

  return (
    <FormShell title={t('sym.details.title')} backTo={back} backLabel={t(`categories.${cat.id}`)} saveLabel={t('sym.details.save')}
      onSave={() => void save()} onDelete={() => void remove()} deleteLabel={t('sym.details.delete')}>
      <p className={`flex items-center gap-3 rounded-3xl p-5 text-xl font-semibold ${cat.card}`}>
        <span className="text-3xl" aria-hidden="true">{symptom?.emoji ?? '•'}</span>{symptomName(kind, catalog, t)}
      </p>
      {needsEmergencyMessage(kind, intensity) && <EmergencyBanner />}
      {symptom && (
        <div>
          <p className="mb-2 font-medium">{t('sym.details.intensity')}</p>
          <IntensityScale max={symptom.scale} value={intensity} onChange={setIntensity} tone={cat.tone} label={t('sym.details.intensity')} />
        </div>
      )}
      <WhenField ts={ts} onChange={setTs} label={t('sym.details.when')} />
      <div>
        <p className="mb-2 font-medium">{t('sym.details.duration')}</p>
        <Segmented<string> label={t('sym.details.duration')} value={duration} onChange={setDuration} optionClass="min-w-[4.5rem]"
          options={DURATIONS.map((d) => ({ value: d.value, label: t(`sym.details.${d.key}`) }))} />
      </div>
      <label className="block"><span className="mb-1 block font-medium">{t('sym.details.note')}</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200" /></label>
    </FormShell>
  )
}
