import { useTranslation } from 'react-i18next'
import { Card, PageHeader } from '@/components/ui'

/** Écrans construits dans les étapes suivantes. */
export function Placeholder({ titleKey, subtitleKey }: { titleKey: string; subtitleKey?: string }) {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t(titleKey)} subtitle={subtitleKey ? t(subtitleKey) : undefined} />
      <div className="space-y-4 px-4">
        <Card><p className="text-ink-soft">{t('common.comingSoon')}</p></Card>
      </div>
    </>
  )
}
