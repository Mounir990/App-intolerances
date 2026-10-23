import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, Chip, PageHeader, Segmented, Stepper, ToggleChip } from '@/components/ui'
import { setFieldValue, useFoodCatalog } from '@/db/foods'
import { saveSettings, useSettings } from '@/db/settings'
import { ALLERGEN_FLAGS, type AllergenFlag } from '@/domain/foods'
import type { Lang } from '@/domain/types'
import { foodName } from '@/features/foods/shared'
import { LANGS, setLanguage } from '@/i18n'
import { applyTheme, THEME_SETTINGS, type ThemeSetting } from '@/theme'
import { CATEGORY_IDS } from '@/features/today/categories'
import { useInstall, useStorage } from './useDeviceInfo'

export function SettingsPage() {
  const { t } = useTranslation()
  const settings = useSettings()
  const catalog = useFoodCatalog()
  const install = useInstall()
  const storage = useStorage()
  if (!settings || !catalog) return null

  const lang = settings.lang
  const personal = catalog.filter((f) => f.personalAlert)
  const toComplete = catalog.filter((f) => f.needsCompletion).length
  const watched = settings.profile.watchedFlags

  const chooseLang = async (l: Lang) => {
    await saveSettings({ lang: l })
    await setLanguage(l)
  }
  const chooseTheme = async (theme: ThemeSetting) => {
    await saveSettings({ theme })
    applyTheme(theme)
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: theme }))
  }
  const toggleCategory = (id: string) =>
    saveSettings({ hiddenCategories: settings.hiddenCategories.includes(id) ? settings.hiddenCategories.filter((x) => x !== id) : [...settings.hiddenCategories, id] })
  const toggleWatched = (flag: AllergenFlag) =>
    saveSettings({ profile: { ...settings.profile, watchedFlags: watched.includes(flag) ? watched.filter((x) => x !== flag) : [...watched, flag] } })

  return (
    <>
      <PageHeader title={t('settings.title')} />
      <div className="space-y-4 px-4">
        <Card title={t('settings.language.title')}>
          <div className="grid grid-cols-2 gap-3">
            {LANGS.map((l) => (
              <Button key={l} variant={lang === l ? 'primary' : 'soft'} aria-pressed={lang === l} onClick={() => void chooseLang(l)}>
                {t(`settings.language.${l}`)}
              </Button>
            ))}
          </div>
        </Card>

        <Card title={t('settings.appearance.title')} hint={t('settings.appearance.hint')}>
          <Segmented<ThemeSetting> label={t('settings.appearance.title')} value={settings.theme}
            options={THEME_SETTINGS.map((x) => ({ value: x, label: t(`settings.appearance.${x}`) }))} onChange={(x) => void chooseTheme(x)} />
        </Card>

        <Card title={t('settings.todayCards.title')} hint={t('settings.todayCards.hint')}>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_IDS.map((id) => (
              <ToggleChip key={id} active={!settings.hiddenCategories.includes(id)} onClick={() => void toggleCategory(id)}>
                {t(`categories.${id}`)}
              </ToggleChip>
            ))}
          </div>
        </Card>

        <Card title={t('settings.symptoms.title')}>
          <p className="mb-3 text-ink-soft">{t('settings.symptoms.hint')}</p>
          <Link to="/settings/symptoms" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-sage-500 px-5 font-medium text-white active:bg-sage-700">
            {t('settings.symptoms.open')}
          </Link>
        </Card>

        <Card title={t('foods.title')}>
          <p className="mb-3 text-ink-soft">{t('foods.toCompleteCount', { count: toComplete })}</p>
          <Link to="/settings/foods" className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-sage-500 px-5 font-medium text-white active:bg-sage-700">
            {t('settings.profile.manage')}
          </Link>
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
            {personal.length === 0 && <span className="text-ink-soft">{t('settings.profile.empty')}</span>}
            {personal.map((f) => (
              <Chip key={f.id} removeLabel={`${t('common.remove')} ${foodName(f, lang)}`} onRemove={() => { if (window.confirm(t('foods.sheet.unmarkConfirm'))) void setFieldValue(f.id, 'personalAlert', '') }}>
                {foodName(f, lang)}
              </Chip>
            ))}
          </div>
          <p className="mt-3 text-sm text-ink-soft">{t('settings.profile.crossHint')}</p>

          <h3 className="mt-6 font-medium">{t('settings.profile.families')}</h3>
          <p className="mt-1 text-sm text-ink-soft">{t('settings.profile.familiesHint')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALLERGEN_FLAGS.filter((f) => f !== 'latex_fruit' && f !== 'latex_fruit_weak').map((f) => (
              <ToggleChip key={f} active={watched.includes(f)} onClick={() => void toggleWatched(f)}>{t(`enum.flag.${f}`)}</ToggleChip>
            ))}
          </div>
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
