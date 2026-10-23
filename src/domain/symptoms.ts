import type { ExtraGroup } from './types'

/**
 * Catalogue des symptômes. Les symptômes « de base » sont définis ici ; l'utilisatrice peut
 * en masquer, changer leur émoji, et en créer (table « symptoms » : surcharges + symptômes perso).
 * Une entrée du journal référence un symptôme par son identifiant.
 */
export type SymptomCategory = 'digestive' | 'skinOrl' | 'gyne'
/** Table du journal où une entrée « simple » (symptôme + intensité) est enregistrée. */
export type SymptomTable = 'digestive' | 'extra' | 'gyne'
export type SymptomScale = 5 | 10

export interface BuiltinSymptom {
  id: string
  category: SymptomCategory
  /** Sous-groupe des symptômes extra-digestifs (peau, ORL, autres). */
  sub?: ExtraGroup
  table: SymptomTable
  scale: SymptomScale
  emoji: string
  /** Route d'un formulaire dédié (carte du corps, Bristol…) au lieu de la saisie rapide en deux taps. */
  special?: string
  /** Symptôme grave : affiche aussitôt le message d'urgence, quelle que soit l'intensité. */
  urgent?: boolean
  /** Symptôme douloureux : le message d'urgence s'affiche à l'intensité maximale (voir emergency.ts). */
  painLike?: boolean
}

const d = (id: string, emoji: string, extra: Partial<BuiltinSymptom> = {}): BuiltinSymptom =>
  ({ id, category: 'digestive', table: 'digestive', scale: 5, emoji, ...extra })
const x = (id: string, sub: ExtraGroup, emoji: string, extra: Partial<BuiltinSymptom> = {}): BuiltinSymptom =>
  ({ id, category: 'skinOrl', sub, table: 'extra', scale: 5, emoji, ...extra })
const g = (id: string, emoji: string, extra: Partial<BuiltinSymptom> = {}): BuiltinSymptom =>
  ({ id, category: 'gyne', table: 'gyne', scale: 10, emoji, ...extra })

export const BUILTIN_SYMPTOMS: BuiltinSymptom[] = [
  // Digestif
  d('pain', '⚡', { special: '/add/digestive/pain', painLike: true }),
  d('bloating', '🎈'),
  d('distension', '🐡'),
  d('belching', '💬'),
  d('gas', '💨'),
  d('acidity', '🔥'),
  d('nausea', '🤢'),
  d('stool', '🚽', { special: '/add/digestive/stool' }),
  d('immediateReaction', '⏱️', { special: '/add/digestive/reaction' }),
  // Peau
  x('itching', 'skin', '😖'),
  x('hives', 'skin', '🔴'),
  x('flush', 'skin', '🥵'),
  x('eczema', 'skin', '🩹'),
  // ORL
  x('nasalCongestion', 'orl', '👃'),
  x('runnyNose', 'orl', '💧'),
  x('sneezing', 'orl', '🤧'),
  x('itchyThroatEars', 'orl', '👂'),
  // Autres
  x('migraine', 'other', '🤕'),
  x('urinary', 'other', '🚻'),
  x('breathingDifficulty', 'other', '🌬️', { urgent: true }),
  x('lipThroatSwelling', 'other', '👄', { urgent: true }),
  x('faintness', 'other', '😵', { urgent: true }),
  // Gynécologie
  g('pelvicPain', '⚡', { table: 'gyne', special: '/add/gyne/pain?region=pelvic', painLike: true }),
  g('legPain', '🦵', { special: '/add/gyne/pain?region=leg', painLike: true }),
  g('bleeding', '🩸', { special: '/add/gyne/bleeding' }),
  g('periodStart', '📅', { special: '/add/gyne/period' }),
  g('painDefecation', '🚽', { painLike: true }),
  g('painUrination', '🚻', { painLike: true }),
  g('endoBelly', '🐡'),
  g('dyspareunia', '💔', { painLike: true }),
]

/** Ligne de la table « symptoms » : surcharge d'un symptôme de base, ou symptôme créé par l'utilisatrice. */
export interface SymptomRow {
  id: string
  /** true = symptôme créé par l'utilisatrice (champs complets) ; sinon surcharge d'un symptôme de base. */
  custom?: boolean
  hidden?: boolean
  emoji?: string
  name?: string
  category?: SymptomCategory
  sub?: ExtraGroup
  scale?: SymptomScale
  createdAt?: number
}

export interface ResolvedSymptom extends BuiltinSymptom {
  /** Nom saisi par l'utilisatrice (symptômes perso) ; les symptômes de base se traduisent via i18n. */
  name?: string
  custom: boolean
  hidden: boolean
}

export const CUSTOM_PREFIX = 'custom:'
export const isCustomSymptom = (id: string) => id.startsWith(CUSTOM_PREFIX)

const TABLE_OF: Record<SymptomCategory, SymptomTable> = { digestive: 'digestive', skinOrl: 'extra', gyne: 'gyne' }

/** Fusionne le catalogue de base et les lignes de l'utilisatrice (émoji, masquage, symptômes perso). */
export function resolveSymptoms(rows: SymptomRow[]): ResolvedSymptom[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const base: ResolvedSymptom[] = BUILTIN_SYMPTOMS.map((b) => {
    const r = byId.get(b.id)
    return { ...b, emoji: r?.emoji || b.emoji, hidden: !!r?.hidden, custom: false }
  })
  const custom: ResolvedSymptom[] = rows
    .filter((r) => r.custom && r.category && r.name)
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
    .map((r) => ({
      id: r.id, category: r.category!, sub: r.category === 'skinOrl' ? r.sub ?? 'other' : undefined,
      table: TABLE_OF[r.category!], scale: r.scale ?? (r.category === 'gyne' ? 10 : 5),
      emoji: r.emoji || '✨', name: r.name, custom: true, hidden: !!r.hidden,
    }))
  return [...base, ...custom]
}

/** Symptômes à proposer : les plus utilisés récemment d'abord, sans masqués. Ordre du catalogue à égalité. */
export function rankByUsage(symptoms: ResolvedSymptom[], usage: Map<string, number>): ResolvedSymptom[] {
  return symptoms
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !s.hidden)
    .sort((a, b) => (usage.get(b.s.id) ?? 0) - (usage.get(a.s.id) ?? 0) || a.i - b.i)
    .map(({ s }) => s)
}
