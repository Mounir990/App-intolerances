import { useLiveQuery } from 'dexie-react-hooks'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, PageHeader } from '@/components/ui'
import { db } from '@/db/db'
import { confirmBlock, deleteCustomFood, revertAllFields, revertField, setFieldValue, useFoodCatalog } from '@/db/foods'
import { seedFieldValue } from '@/domain/effective'
import type { FoodFieldValues, OverridableField } from '@/domain/foods'
import { FoodEditor } from './FoodEditor'
import { foodName, foodOtherName, useLang } from './shared'

/** Fiche d'un aliment : tout est modifiable ; chaque champ modifié peut revenir à sa valeur d'origine. */
export function FoodSheetPage() {
  const { id = '' } = useParams()
  const { t } = useTranslation()
  const lang = useLang()
  const navigate = useNavigate()
  const catalog = useFoodCatalog()
  const seed = useLiveQuery(() => db.foods.get(id), [id])
  if (!catalog) return null
  const food = catalog.find((f) => f.id === id)
  if (!food) {
    return (
      <>
        <PageHeader title={t('foods.sheet.notFound')} />
        <div className="px-4"><Link to="/settings/foods" className="text-sage-700 underline">{t('foods.sheet.back')}</Link></div>
      </>
    )
  }

  const originals: Partial<FoodFieldValues> = {}
  if (seed) for (const f of food.overridden) (originals as Record<string, unknown>)[f] = seedFieldValue(seed, f)

  const del = async () => {
    if (window.confirm(t('foods.sheet.deleteConfirm'))) {
      await deleteCustomFood(food.id)
      navigate('/settings/foods', { replace: true })
    }
  }

  return (
    <>
      <PageHeader title={foodName(food, lang)} subtitle={foodOtherName(food, lang) !== foodName(food, lang) ? `${foodOtherName(food, lang)} · ${food.category}` : food.category} />
      <div className="space-y-4 px-4 pb-8">
        <Link to="/settings/foods" className="inline-flex min-h-11 items-center text-sage-700">← {t('foods.sheet.back')}</Link>

        <FoodEditor
          values={food}
          foodId={food.id}
          confirmUnmark
          onChange={(field, value) => void setFieldValue(food.id, field, value)}
          overridden={food.overridden}
          originals={originals}
          seedChanged={food.seedChanged}
          onRevert={(field: OverridableField) => void revertField(food.id, field)}
          histamineReliability={food.histamineReliability}
          fodmapReliability={food.fodmapReliability}
          histamineSources={food.histamineSources}
          fodmapSources={food.fodmapSources}
          onConfirm={(block) => void confirmBlock(food, block)}
        />

        {food.modifiedAt && (
          <p className="text-sm text-ink-soft">{t('foods.sheet.modified', { date: new Date(food.modifiedAt).toLocaleString(lang) })}</p>
        )}
        {food.origin === 'seed' && food.overridden.length > 0 && (
          <Button variant="ghost" className="w-full"
            onClick={() => { if (window.confirm(t('foods.sheet.revertAllConfirm'))) void revertAllFields(food.id) }}>
            ↺ {t('foods.sheet.revertAll')}
          </Button>
        )}
        {food.origin === 'custom'
          ? <Button variant="danger" className="w-full" onClick={() => void del()}>{t('foods.sheet.delete')}</Button>
          : <p className="text-sm text-ink-soft">{t('foods.sheet.onlyMine')}</p>}
      </div>
    </>
  )
}
