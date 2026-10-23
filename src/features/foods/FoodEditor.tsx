import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, Segmented, ToggleChip } from '@/components/ui'
import {
  ALLERGEN_FLAGS, DAO_VALUES, FODMAP_LEVELS, FODMAP_TYPE_VOCABULARY, HISTAMINE_LEVELS, LIBERATOR_VALUES,
  type AllergenFlag, type FoodFieldValues, type OverridableField, type Reliability,
} from '@/domain/foods'
import { useSources, userSourceId } from '@/db/foods'
import { DisclaimerNote, ReliabilityBadge, SourceList } from './shared'

const baseType = (t: string) => t.replace(/\s*\(.*\)\s*$/, '').trim()

export interface FoodEditorProps {
  values: FoodFieldValues
  onChange: <F extends OverridableField>(field: F, value: FoodFieldValues[F]) => void
  /** Fiche d'un aliment de la base : champs modifiés + valeurs d'origine pour « revenir à l'origine ». */
  overridden?: OverridableField[]
  originals?: Partial<FoodFieldValues>
  seedChanged?: OverridableField[]
  onRevert?: (field: OverridableField) => void
  histamineReliability?: Reliability
  fodmapReliability?: Reliability
  histamineSources?: string[]
  fodmapSources?: string[]
  onConfirm?: (block: 'histamine' | 'fodmap') => void
  /** Demande « Tu es sûre ? » avant de démarquer un allergène personnel (fiche d'un aliment existant). */
  confirmUnmark?: boolean
  /** Id de l'aliment (pour retrouver sa « Ma source »). */
  foodId?: string
}

/** Champ texte : enregistre à la sortie du champ (pas à chaque frappe). */
function TextField({ value, onCommit, label, multiline, placeholder }: {
  value: string; onCommit: (v: string) => void; label: string; multiline?: boolean; placeholder?: string
}) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  const common = {
    value: v, placeholder, 'aria-label': label,
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => { if (v !== value) onCommit(v) },
    className: 'w-full rounded-2xl bg-white px-4 py-3 ring-1 ring-sand-200 placeholder:text-ink-soft/60',
  }
  return multiline ? <textarea rows={3} {...common} /> : <input type="text" {...common} />
}

export function FoodEditor(p: FoodEditorProps) {
  const { t } = useTranslation()
  const { values: v, onChange } = p
  const sources = useSources()

  /** Démarquer un allergène est un geste à risque : on demande confirmation (cf. alerte qui ne se déclenchera plus). */
  const setPersonal = (on: boolean) => {
    if (!on && p.confirmUnmark && !window.confirm(t('foods.sheet.unmarkConfirm'))) return
    onChange('personalAlert', on ? 'allergene_confirme' : '')
  }
  const mySourceIds = (block: 'histamine' | 'fodmap') => (p.foodId && sources.has(userSourceId(p.foodId, block)) ? [userSourceId(p.foodId, block)] : [])

  /** Texte lisible d'une valeur, pour « Origine : … ». */
  const show = (field: OverridableField, value: unknown): string => {
    if (value === undefined || value === null || value === '') return '—'
    if (Array.isArray(value)) return value.length ? value.map((x) => (field === 'flags' ? t(`enum.flag.${x as AllergenFlag}`) : String(x))).join(', ') : '—'
    const map: Partial<Record<OverridableField, string>> = {
      histamineLevel: 'enum.histamine', fodmapLevel: 'enum.fodmap', liberator: 'enum.liberator', dao: 'enum.dao',
    }
    return map[field] ? t(`${map[field]}.${String(value)}`) : String(value)
  }

  /** En-tête d'un champ : libellé + « modifié » + retour à l'origine. */
  const Head = ({ field, label }: { field: OverridableField; label: string }) => {
    const edited = p.overridden?.includes(field)
    return (
      <div className="mb-1.5 mt-4 first:mt-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{label}{edited && <span className="ml-2 rounded-full bg-user-bg px-2 py-0.5 text-xs font-normal text-user">{t('foods.sheet.edited')}</span>}</span>
          {edited && p.onRevert && (
            <button type="button" onClick={() => p.onRevert!(field)} className="min-h-10 rounded-full px-3 text-sm text-sage-700 active:bg-sage-50">
              ↺ {t('foods.sheet.revert')}
            </button>
          )}
        </div>
        {edited && p.originals && (
          <p className="text-sm text-ink-soft">{t('foods.sheet.original', { value: show(field, p.originals[field]) })}</p>
        )}
        {p.seedChanged?.includes(field) && <p className="mt-1 text-sm text-warn">{t('foods.sheet.seedChanged')}</p>}
      </div>
    )
  }

  const allSources = sources
  const Block = ({ block, reliability, sources, children, title }: {
    block: 'histamine' | 'fodmap'; reliability?: Reliability; sources?: string[]; children: ReactNode; title: string
  }) => (
    <Card title={title}>
      {reliability && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ReliabilityBadge value={reliability} />
        </div>
      )}
      {sources && sources.length > 0 && (
        <div className="mb-3">
          <p className="mb-1.5 text-sm font-medium">{t('foods.sheet.sources')}</p>
          <SourceList ids={sources} sources={allSources} />
          <p className="mt-1 text-xs text-ink-soft">{t('foods.sources.note')}</p>
        </div>
      )}
      {children}
      {p.onConfirm && reliability !== 'utilisateur' && (
        <Button className="mt-4 w-full" onClick={() => p.onConfirm!(block)}>✓ {t('foods.sheet.confirm')}</Button>
      )}
    </Card>
  )

  const levelOpts = (kind: 'histamine' | 'fodmap', list: readonly string[]) =>
    list.map((value) => ({ value, label: t(`enum.${kind}.${value}`), aria: value === 'inconnu' ? t('enum.unknownLabel') : undefined }))

  const activeTypes = new Set(v.fodmapTypes.map(baseType))
  const extraTypes = v.fodmapTypes.filter((x) => !(FODMAP_TYPE_VOCABULARY as readonly string[]).includes(baseType(x)))
  const toggleType = (type: string) =>
    onChange('fodmapTypes', activeTypes.has(type) ? v.fodmapTypes.filter((x) => baseType(x) !== type) : [...v.fodmapTypes, type])

  return (
    <div className="space-y-4">
      <DisclaimerNote />

      <Card title={t('foods.sheet.personal')} hint={t('foods.sheet.personalHint')}>
        <ToggleChip active={v.personalAlert === 'allergene_confirme'}
          onClick={() => setPersonal(!v.personalAlert)}>
          {v.personalAlert ? '⚠ ' : ''}{t('foods.sheet.personalOn')}
        </ToggleChip>
        {p.overridden?.includes('personalAlert') && p.onRevert && (
          <button type="button" className="ml-2 min-h-10 rounded-full px-3 text-sm text-sage-700 active:bg-sage-50" onClick={() => { if (v.personalAlert && p.originals?.personalAlert === '' && p.confirmUnmark && !window.confirm(t('foods.sheet.unmarkConfirm'))) return; p.onRevert!('personalAlert') }}>
            ↺ {t('foods.sheet.revert')}
          </button>
        )}
      </Card>

      <Block block="histamine" title={t('foods.sheet.histamine')} reliability={p.histamineReliability} sources={p.histamineSources}>
        <Head field="histamineLevel" label={t('foods.sheet.level')} />
        <Segmented label={t('foods.sheet.level')} value={v.histamineLevel} options={levelOpts('histamine', HISTAMINE_LEVELS) as never}
          onChange={(x) => onChange('histamineLevel', x as FoodFieldValues['histamineLevel'])} />
        <Head field="histamineDetail" label={t('foods.sheet.detail')} />
        <TextField multiline label={t('foods.sheet.detail')} value={v.histamineDetail} onCommit={(x) => onChange('histamineDetail', x)} />
        <Head field="liberator" label={t('foods.sheet.liberator')} />
        <Segmented label={t('foods.sheet.liberator')} value={v.liberator}
          options={LIBERATOR_VALUES.map((x) => ({ value: x, label: t(`enum.liberator.${x}`), aria: x === 'inconnu' ? t('enum.unknownLabel') : undefined }))}
          onChange={(x) => onChange('liberator', x)} />
        <Head field="dao" label={t('foods.sheet.dao')} />
        <Segmented label={t('foods.sheet.dao')} value={v.dao} options={DAO_VALUES.map((x) => ({ value: x, label: t(`enum.dao.${x}`) }))}
          onChange={(x) => onChange('dao', x)} />
        <Head field="otherAmines" label={t('foods.sheet.amines')} />
        <TextField label={t('foods.sheet.amines')} value={v.otherAmines} onCommit={(x) => onChange('otherAmines', x)} />
        <Head field="mySourceHistamine" label={t('foods.sheet.mySource')} />
        <TextField label={t('foods.sheet.mySource')} value={v.mySourceHistamine} onCommit={(x) => onChange('mySourceHistamine', x)} />
        <SourceList ids={mySourceIds('histamine')} sources={sources} />
      </Block>

      <Block block="fodmap" title={t('foods.sheet.fodmap')} reliability={p.fodmapReliability} sources={p.fodmapSources}>
        <Head field="fodmapLevel" label={t('foods.sheet.level')} />
        <Segmented label={t('foods.sheet.level')} value={v.fodmapLevel} options={levelOpts('fodmap', FODMAP_LEVELS) as never}
          onChange={(x) => onChange('fodmapLevel', x as FoodFieldValues['fodmapLevel'])} />
        <Head field="fodmapPortion" label={t('foods.sheet.portion')} />
        <TextField label={t('foods.sheet.portion')} value={v.fodmapPortion} onCommit={(x) => onChange('fodmapPortion', x)} />
        <Head field="fodmapTypes" label={t('foods.sheet.types')} />
        <div className="flex flex-wrap gap-2">
          {FODMAP_TYPE_VOCABULARY.map((type) => (
            <ToggleChip key={type} active={activeTypes.has(type)} onClick={() => toggleType(type)}>{t(`enum.fodmapType.${type}`)}</ToggleChip>
          ))}
          {extraTypes.map((x) => (
            <ToggleChip key={x} active onClick={() => onChange('fodmapTypes', v.fodmapTypes.filter((y) => y !== x))}>{x} ×</ToggleChip>
          ))}
        </div>
        <Head field="mySourceFodmap" label={t('foods.sheet.mySource')} />
        <TextField label={t('foods.sheet.mySource')} value={v.mySourceFodmap} onCommit={(x) => onChange('mySourceFodmap', x)} />
        <SourceList ids={mySourceIds('fodmap')} sources={sources} />
      </Block>

      <Card title={t('foods.sheet.flags')} hint={t('foods.sheet.flagsHint')}>
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_FLAGS.map((f) => (
            <ToggleChip key={f} active={v.flags.includes(f)}
              onClick={() => onChange('flags', v.flags.includes(f) ? v.flags.filter((x) => x !== f) : [...v.flags, f])}>
              {t(`enum.flag.${f}`)}
            </ToggleChip>
          ))}
        </div>
        {p.overridden?.includes('flags') && <Head field="flags" label="" />}
      </Card>

      <Card title={t('foods.sheet.remark')}>
        <Head field="remark" label="" />
        <TextField multiline label={t('foods.sheet.remark')} value={v.remark} onCommit={(x) => onChange('remark', x)} />
      </Card>
    </div>
  )
}
