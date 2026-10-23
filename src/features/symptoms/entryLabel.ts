import type { AnyEntry, EntryTable } from '@/db/entries'
import { CATEGORY_OF_TABLE } from '@/db/entries'
import type { ResolvedSymptom } from '@/domain/symptoms'
import { CATEGORIES, type CategoryDef } from '@/features/today/categories'
import { timeKey } from '@/domain/time'

type T = (key: string, options?: Record<string, unknown>) => string

/** Nom affichable d'un symptôme : symptômes de base traduits, symptômes perso tels que saisis. */
export function symptomName(id: string, catalog: ResolvedSymptom[], t: T): string {
  const s = catalog.find((x) => x.id === id)
  if (s?.custom) return s.name ?? id
  return s ? t(`symptoms.${id}`) : t('meals.form.deletedRecipe')
}

export interface EntryView {
  emoji: string
  title: string
  detail: string
  time: string
  category: CategoryDef
}

const num = (v: unknown) => (typeof v === 'number' ? v : undefined)

/** Ligne de résumé d'une entrée pour les listes (écrans de catégorie, et plus tard la timeline). */
export function describeEntry(table: EntryTable, e: AnyEntry, catalog: ResolvedSymptom[], t: T): EntryView {
  const category = CATEGORIES[CATEGORY_OF_TABLE[table]]
  const time = timeKey(e.ts)
  const symptom = (id: string) => catalog.find((x) => x.id === id)
  const withScale = (id: string, i?: number) => (i === undefined ? '' : `${i}/${symptom(id)?.scale ?? 5}`)
  const parts = (...p: (string | undefined | false)[]) => p.filter(Boolean).join(' · ')
  const dur = (m: unknown) => (typeof m === 'number' ? `${m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`}` : undefined)

  if (table === 'digestive') {
    const kind = String(e.kind)
    const base = { emoji: symptom(kind)?.emoji ?? '•', title: symptomName(kind, catalog, t), time, category }
    if (kind === 'stool') return { ...base, detail: parts(e.bristol ? `Bristol ${e.bristol}` : '', num(e.count) ? t('sym.stool.count') + ` ${e.count}` : '') }
    if (kind === 'immediateReaction') {
      return { ...base, detail: parts(e.reaction ? t(`sym.reaction.${String(e.reaction)}`) : '', num(e.minutesAfterMeal) ? `+${e.minutesAfterMeal} min` : '') }
    }
    if (kind === 'pain') {
      return { ...base, detail: parts(withScale(kind, num(e.intensity)), e.location ? t(`bodyZone.${String(e.location)}`) : '', e.reliefByToilet === true && '✓ WC') }
    }
    return { ...base, detail: parts(withScale(kind, num(e.intensity)), dur(e.durationMin)) }
  }
  if (table === 'extra') {
    const kind = String(e.kind)
    return { emoji: symptom(kind)?.emoji ?? '•', title: symptomName(kind, catalog, t), time, category, detail: parts(withScale(kind, num(e.intensity)), dur(e.durationMin)) }
  }
  if (table === 'gyne') {
    const kind = String(e.kind)
    const base = { emoji: symptom(kind)?.emoji ?? '•', title: symptomName(kind, catalog, t), time, category }
    if (kind === 'bleeding') return { ...base, detail: e.bleedingType ? t(`sym.bleeding.types.${String(e.bleedingType)}`) : '' }
    return { ...base, detail: parts(withScale(kind, num(e.intensity)), dur(e.durationMin)) }
  }
  if (table === 'pain') {
    const id = e.region === 'leg' ? 'legPain' : 'pelvicPain'
    const zones = Array.isArray(e.zones) ? (e.zones as { zone: string }[]).map((z) => t(`bodyZone.${z.zone}`)).join(', ') : ''
    return { emoji: symptom(id)?.emoji ?? '⚡', title: symptomName(id, catalog, t), time, category, detail: parts(withScale(id, num(e.intensity)), e.painType ? t(`sym.pain.types.${String(e.painType)}`) : '', zones) }
  }
  if (table === 'cycleStarts') {
    return { emoji: symptom('periodStart')?.emoji ?? '📅', title: symptomName('periodStart', catalog, t), time, category, detail: '' }
  }
  // context
  const kind = String(e.kind)
  const emoji = { stress: '😣', sleep: '😴', activity: '🏃', medication: '💊' }[kind] ?? '•'
  const title = t(`sym.context.${kind}`)
  if (kind === 'stress') return { emoji, title, time, category, detail: `${e.stress}/5` }
  if (kind === 'sleep') return { emoji, title, time, category, detail: parts(num(e.sleepHours) ? `${e.sleepHours} h` : '', num(e.sleepQuality) ? `${e.sleepQuality}/5` : '', num(e.painWakeups) ? `${e.painWakeups}×` : '') }
  if (kind === 'activity') return { emoji, title, time, category, detail: parts(e.activity ? t(`sym.context.activities.${String(e.activity)}`, { defaultValue: String(e.activity) }) : '', dur(e.activityMinutes)) }
  return { emoji, title, time, category, detail: String(e.medName ?? '') }
}

/** Route de modification d'une entrée (formulaire dédié ou fiche de détails). */
export function editPath(table: EntryTable, e: AnyEntry): string {
  const id = e.id
  if (table === 'pain') return `/add/gyne/pain/${id}`
  if (table === 'cycleStarts') return `/add/gyne/period/${id}`
  if (table === 'context') return `/add/context/${String(e.kind)}/${id}`
  const kind = String(e.kind)
  if (table === 'digestive' && kind === 'pain') return `/add/digestive/pain/${id}`
  if (table === 'digestive' && kind === 'stool') return `/add/digestive/stool/${id}`
  if (table === 'digestive' && kind === 'immediateReaction') return `/add/digestive/reaction/${id}`
  if (table === 'gyne' && kind === 'bleeding') return `/add/gyne/bleeding/${id}`
  return `/add/entry/${table}/${id}`
}
