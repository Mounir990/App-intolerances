import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, PageHeader } from '@/components/ui'
import { CATEGORIES, type CategoryId } from './categories'

/** Écrans de saisie : construits à l'étape suivante. Cette page évite un lien mort depuis « Aujourd'hui ». */
export function AddPlaceholder() {
  const { t } = useTranslation()
  const { category = 'symptom' } = useParams()
  const known = category in CATEGORIES
  const title = known ? t(`categories.${category as CategoryId}`) : t('add.symptom')
  return (
    <>
      <PageHeader title={title} />
      <div className="space-y-4 px-4">
        <Link to="/" className="inline-flex min-h-11 items-center text-sage-700">← {t('add.back')}</Link>
        <Card><p className="text-ink-soft">{t('add.soon')}</p></Card>
      </div>
    </>
  )
}
