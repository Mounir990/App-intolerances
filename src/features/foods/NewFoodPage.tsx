import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, PageHeader } from '@/components/ui'
import { addCustomFood, useFoodCatalog } from '@/db/foods'
import { EMPTY_FOOD_VALUES, type FoodFieldValues } from '@/domain/foods'
import { FoodEditor } from './FoodEditor'
import { useLang } from './shared'


/** Création d'un aliment personnalisé : noms FR + ES, catégorie et mêmes champs que la fiche. */
export function NewFoodPage() {
  const { t } = useTranslation()
  const lang = useLang()
  const navigate = useNavigate()
  const catalog = useFoodCatalog()
  const [nameFr, setNameFr] = useState('')
  const [nameEs, setNameEs] = useState('')
  const [category, setCategory] = useState('')
  const [values, setValues] = useState<FoodFieldValues>(EMPTY_FOOD_VALUES)
  const [error, setError] = useState('')

  const categories = [...new Set((catalog ?? []).map((f) => f.category))].sort((a, b) => a.localeCompare(b, lang))
  const input = 'w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200'

  const save = async () => {
    if (!nameFr.trim() && !nameEs.trim()) { setError(t('foods.new.needName')); return }
    const id = await addCustomFood({ ...values, nameFr, nameEs, category })
    navigate(`/settings/foods/${id}`, { replace: true })
  }

  return (
    <>
      <PageHeader title={t('foods.new.title')} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/settings/foods" className="inline-flex min-h-11 items-center text-sage-700">← {t('foods.sheet.back')}</Link>
        <Card hint={t('foods.new.namesHint')}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block font-medium">{t('foods.new.nameFr')}</span>
              <input className={input} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">{t('foods.new.nameEs')}</span>
              <input className={input} value={nameEs} onChange={(e) => setNameEs(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block font-medium">{t('foods.new.category')}</span>
              <input className={input} list="food-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
              <datalist id="food-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </label>
          </div>
        </Card>
        <FoodEditor values={values} onChange={(field, value) => setValues((v) => ({ ...v, [field]: value }))} />
        {error && <p role="alert" className="text-alert">{error}</p>}
        <Button variant="primary" className="w-full" onClick={() => void save()}>{t('foods.new.save')}</Button>
      </div>
    </>
  )
}
