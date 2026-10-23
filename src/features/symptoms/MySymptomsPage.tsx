import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, PageHeader, Segmented } from '@/components/ui'
import { addCustomSymptom, deleteCustomSymptom, setSymptomEmoji, setSymptomHidden, useSymptomCatalog } from '@/db/symptoms'
import type { ResolvedSymptom, SymptomCategory } from '@/domain/symptoms'

const CATEGORIES: SymptomCategory[] = ['digestive', 'skinOrl', 'gyne']
const SUGGESTED = ['🦶', '🦵', '🤒', '😖', '🥶', '💓', '🧠', '😴', '🦷', '👁️', '💥', '🌡️', '✨']

function Row({ s }: { s: ResolvedSymptom }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const label = s.custom ? s.name : t(`symptoms.${s.id}`)
  return (
    <li className={`rounded-2xl bg-white p-3 ring-1 ring-sand-200 ${s.hidden ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`${t('settings.symptoms.emoji')} : ${label}`} aria-expanded={editing} onClick={() => setEditing((e) => !e)}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sand-100 text-2xl active:bg-sage-100">{s.emoji}</button>
        <span className="min-w-0 flex-1 font-medium">
          {label}
          {s.custom && <span className="ml-2 rounded-full bg-user-bg px-2 py-0.5 text-xs font-normal text-user">{t('settings.symptoms.custom')}</span>}
          {s.hidden && <span className="ml-2 text-sm font-normal text-ink-soft">({t('settings.symptoms.hidden')})</span>}
        </span>
        <Button className="shrink-0 px-4 text-sm" onClick={() => void setSymptomHidden(s.id, !s.hidden)}>
          {t(s.hidden ? 'settings.symptoms.show' : 'settings.symptoms.hide')}
        </Button>
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED.map((e) => (
              <button key={e} type="button" aria-label={e} onClick={() => void setSymptomEmoji(s.id, e)}
                className="grid h-11 w-11 place-items-center rounded-xl bg-sand-100 text-xl active:bg-sage-100">{e}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input defaultValue="" maxLength={8} placeholder={s.emoji} aria-label={t('settings.symptoms.emoji')}
              onBlur={(e) => { if (e.target.value.trim()) void setSymptomEmoji(s.id, e.target.value) }}
              className="min-h-11 w-24 rounded-xl bg-white px-3 text-center text-xl ring-1 ring-sand-200" />
            {s.custom && (
              <Button variant="danger" className="text-sm"
                onClick={() => { if (window.confirm(t('settings.symptoms.deleteConfirm'))) void deleteCustomSymptom(s.id) }}>
                {t('settings.symptoms.delete')}
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

/** Réglages › Mes symptômes : masquer, changer l'émoji, créer ses propres symptômes. */
export function MySymptomsPage() {
  const { t } = useTranslation()
  const catalog = useSymptomCatalog()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('')
  const [category, setCategory] = useState<SymptomCategory>('skinOrl')
  const [error, setError] = useState('')
  const create = async () => {
    if (!name.trim()) { setError(t('sym.errors.name')); return }
    await addCustomSymptom({ name, emoji, category })
    setName(''); setEmoji(''); setError('')
  }
  return (
    <>
      <PageHeader title={t('settings.symptoms.title')} subtitle={t('settings.symptoms.hint')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/settings" className="inline-flex min-h-11 items-center text-sage-700">← {t('settings.title')}</Link>
        <Card title={t('settings.symptoms.add')}>
          <div className="space-y-3">
            <label className="block"><span className="mb-1 block font-medium">{t('settings.symptoms.name')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} className="min-h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-sand-200" /></label>
            <label className="block"><span className="mb-1 block font-medium">{t('settings.symptoms.emoji')}</span>
              <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={8} className="min-h-12 w-24 rounded-2xl bg-white px-4 text-center text-2xl ring-1 ring-sand-200" /></label>
            <span className="block font-medium">{t('settings.symptoms.category')}</span>
            <Segmented<SymptomCategory> label={t('settings.symptoms.category')} value={category} onChange={setCategory} optionClass="min-w-[7rem]"
              options={CATEGORIES.map((c) => ({ value: c, label: t(`categories.${c}`) }))} />
            {error && <p role="alert" className="text-alert">{error}</p>}
            <Button variant="primary" className="w-full" onClick={() => void create()}>{t('settings.symptoms.save')}</Button>
          </div>
        </Card>
        {CATEGORIES.map((c) => (
          <section key={c}>
            <h2 className="mb-2 text-lg font-semibold">{t(`categories.${c}`)}</h2>
            <ul className="space-y-2">{catalog.filter((s) => s.category === c).map((s) => <Row key={s.id} s={s} />)}</ul>
          </section>
        ))}
      </div>
    </>
  )
}
