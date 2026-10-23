import { useTranslation } from 'react-i18next'
import { Button, Card, Chip, PageHeader, Stepper } from '@/components/ui'
import { saveSettings, useSettings } from '@/db/settings'
import { DEFAULT_SETTINGS } from '@/domain/defaults'
import { LANGS, setLanguage } from '@/i18n'
import type { Lang } from '@/domain/types'
import { useInstall, useStorage } from './useDeviceInfo'

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const install = useInstall()
  const storage = useStorage()
  if (!settings) return null

  const lang = settings.lang
  const { profile } = settings

  const chooseLang = async (l: Lang) => {
    await saveSettings({ lang: l })
    await setLanguage(l)
  }
  const removeAllergy = (id: string) =>
    saveSettings({ profile: { ...profile, allergies: profile.allergies.filter((a) => a.id !== id) } })
  const removeFamily = (id: string) =>
    saveSettings({ profile: { ...profile, watchedFamilies: profile.watchedFamilies.filter((f) => f.id !== id) } })
  const resetProfile = () => {
    if (window.confirm(t('settings.profile.resetConfirm'))) {
      void saveSettings({ profile: structuredClone(DEFAULT_SETTINGS.profile) })
    }
  }

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="space-y-4 px-4">
        <Card title={t('settings.language.title')}>
          <div className="grid grid-cols-2 gap-3">
            {LANGS.map((l) => (
              <Button key={l} variant={lang === l ? 'primary' : 'soft'} aria-pressed={lang === l}
                onClick={() => void chooseLang(l)}>
                {t(`settings.language.${l}`)}
              </Button>
            ))}
          </div>
        </Card>

        <Card title={t('settings.cycle.title')} hint={t('settings.cycle.hint')}>
          <div className="space-y-4">
            <Stepper label={t('settings.cycle.length')} unit={t('settings.cycle.days')} min={21} max={45}
              value={settings.cycleLength} onChange={(v) => void saveSettings({ cycleLength: v })} />
            <Stepper label={t('settings.cycle.period')} unit={t('settings.cycle.days')} min={2} max={10}
              value={settings.periodLength} onChange={(v) => void saveSettings({ periodLength: v })} />
          </div>
        </Card>

        <Card title={t('settings.profile.title')}>
          <h3 className="font-medium">{t('settings.profile.allergies')}</h3>
          <p className="mt-1 text-sm text-ink-soft">{t('settings.profile.allergiesHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.allergies.length === 0 && <span className="text-ink-soft">{t('settings.profile.empty')}</span>}
            {profile.allergies.map((a) => (
              <Chip key={a.id} removeLabel={`${t('common.remove')} ${a.label[lang]}`} onRemove={() => void removeAllergy(a.id)}>
                {a.label[lang]}{a.crossReactive ? ` · ${t('settings.profile.crossReactive')}` : ''}
              </Chip>
            ))}
          </div>

          <h3 className="mt-6 font-medium">{t('settings.profile.families')}</h3>
          <p className="mt-1 text-sm text-ink-soft">{t('settings.profile.familiesHint')}</p>
          <div className="mt-3 space-y-3">
            {profile.watchedFamilies.length === 0 && <span className="text-ink-soft">{t('settings.profile.empty')}</span>}
            {profile.watchedFamilies.map((f) => (
              <div key={f.id}>
                <Chip removeLabel={`${t('common.remove')} ${f.label[lang]}`} onRemove={() => void removeFamily(f.id)}>
                  {f.label[lang]}
                </Chip>
                <p className="mt-1 text-sm text-ink-soft">{f.foodLabels.map((l) => l[lang]).join(' · ')}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-sm text-ink-soft">{t('settings.profile.addLater')}</p>
          <Button variant="ghost" className="mt-2" onClick={resetProfile}>{t('settings.profile.reset')}</Button>
        </Card>

        <Card title={t('settings.install.title')}>
          {install.installed ? (
            <p>{t('settings.install.installed')}</p>
          ) : install.canPrompt ? (
            <Button variant="primary" onClick={() => void install.install()}>{t('settings.install.button')}</Button>
          ) : (
            <p className="text-ink-soft">{t('settings.install.hintAndroid')}</p>
          )}
        </Card>

        <Card title={t('settings.storage.title')} hint={t('settings.storage.local')}>
          <p className="font-medium">{t('settings.storage.persistent')}</p>
          <p className="text-sm text-ink-soft">
            {storage.persisted ? t('settings.storage.persistentYes') : t('settings.storage.persistentNo')}
          </p>
          {storage.persisted === false && (
            <Button className="mt-3" onClick={() => void storage.protect()}>{t('settings.storage.protect')}</Button>
          )}
          {storage.usageBytes !== null && (
            <p className="mt-3 text-sm text-ink-soft">
              {t('settings.storage.usage')} : {(storage.usageBytes / 1024 / 1024).toFixed(1)} Mo
            </p>
          )}
        </Card>
      </div>
    </>
  )
}
