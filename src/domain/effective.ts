import {
  FODMAP_BLOCK, HISTAMINE_BLOCK,
  type CustomFoodRecord, type EffectiveFood, type FodmapLevel, type FoodFieldValues, type FoodOverride,
  type HistamineLevel, type Liberator, type OverridableField, type Reliability, type SeedFoodRecord,
} from './foods'

// ───────────── « inconnu » n'est jamais « bas » ni « non » ─────────────
// Ces helpers renvoient null pour une valeur inconnue : tout code (rapport, phase 2
// de corrélations) doit gérer ce cas explicitement au lieu de le confondre avec « bas ».

const HIST_RANK: Record<HistamineLevel, number | null> = { bas: 0, moyen: 1, eleve: 2, inconnu: null }
const FODMAP_RANK: Record<FodmapLevel, number | null> = { bas: 0, bas_selon_portion: 1, eleve: 2, inconnu: null }

export const histamineRank = (l: HistamineLevel): number | null => HIST_RANK[l]
export const fodmapRank = (l: FodmapLevel): number | null => FODMAP_RANK[l]

/** true / false si connu, null si inconnu. Jamais false pour un inconnu. */
export const isLiberator = (l: Liberator): boolean | null =>
  l === 'signale' ? true : l === 'non_signale' ? false : null

/** Niveau le plus élevé parmi les niveaux CONNUS ; `hasUnknown` dit si des inconnus ont été ignorés. */
export function maxKnown<T extends string>(
  levels: T[], rank: (l: T) => number | null,
): { level: T | null; hasUnknown: boolean } {
  let best: T | null = null
  let bestRank = -1
  let hasUnknown = false
  for (const l of levels) {
    const r = rank(l)
    if (r === null) { hasUnknown = true; continue }
    if (r > bestRank) { best = l; bestRank = r }
  }
  return { level: best, hasUnknown }
}

// ───────────── Valeur effective = modification si elle existe, sinon seed ─────────────

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const needsCompletion = (v: Pick<FoodFieldValues, 'histamineLevel' | 'liberator' | 'fodmapLevel'>) =>
  v.histamineLevel === 'inconnu' || v.liberator === 'inconnu' || v.fodmapLevel === 'inconnu'

function blockReliability(
  seedReliability: Reliability, level: string, touched: boolean,
): Reliability {
  if (level === 'inconnu') return 'inconnue'
  return touched ? 'utilisateur' : seedReliability
}

/** Combine un aliment du seed et ses modifications. Pure : aucune lecture de base. */
export function resolveSeedFood(seed: SeedFoodRecord, overrides: FoodOverride[]): EffectiveFood {
  const mine = overrides.filter((o) => o.foodId === seed.id)
  const byField = new Map(mine.map((o) => [o.field, o]))

  const values: FoodFieldValues = {
    personalAlert: seed.personalAlert,
    histamineLevel: seed.histamineLevel,
    histamineDetail: seed.histamineDetail,
    liberator: seed.liberator,
    dao: seed.dao,
    otherAmines: seed.otherAmines,
    fodmapLevel: seed.fodmapLevel,
    fodmapPortion: seed.fodmapPortion,
    fodmapTypes: seed.fodmapTypes,
    remark: seed.remark,
    flags: seed.flags,
    mySourceHistamine: '',
    mySourceFodmap: '',
  }
  const seedValue = (field: OverridableField): unknown => (field in seed ? (seed as unknown as Record<string, unknown>)[field] : '')
  const out = values as unknown as Record<string, unknown>
  for (const [field, o] of byField) out[field] = o.value

  const overridden = [...byField.keys()]
  const seedChanged = mine.filter((o) => !same(o.seedAtEdit, seedValue(o.field))).map((o) => o.field)
  const touched = (block: readonly OverridableField[]) => block.some((f) => byField.has(f))

  return {
    ...values,
    id: seed.id,
    origin: 'seed',
    category: seed.category,
    nameFr: seed.nameFr,
    nameEs: seed.nameEs,
    aliases: seed.aliases,
    histamineSources: seed.histamineSources,
    fodmapSources: seed.fodmapSources,
    histamineReliability: blockReliability(seed.histamineReliability, values.histamineLevel, touched(HISTAMINE_BLOCK)),
    fodmapReliability: blockReliability(seed.fodmapReliability, values.fodmapLevel, touched(FODMAP_BLOCK)),
    overridden,
    seedChanged,
    modifiedAt: mine.length ? Math.max(...mine.map((o) => o.updatedAt)) : undefined,
    needsCompletion: needsCompletion(values),
  }
}

/** Un aliment perso n'a pas de seed : ses valeurs sont les siennes (« vérifiées par moi » si connues). */
export function resolveCustomFood(c: CustomFoodRecord): EffectiveFood {
  return {
    id: c.id,
    origin: 'custom',
    category: c.category,
    nameFr: c.nameFr,
    nameEs: c.nameEs,
    aliases: c.aliases,
    personalAlert: c.personalAlert,
    histamineLevel: c.histamineLevel,
    histamineDetail: c.histamineDetail,
    liberator: c.liberator,
    dao: c.dao,
    otherAmines: c.otherAmines,
    fodmapLevel: c.fodmapLevel,
    fodmapPortion: c.fodmapPortion,
    fodmapTypes: c.fodmapTypes,
    remark: c.remark,
    flags: c.flags,
    mySourceHistamine: c.mySourceHistamine,
    mySourceFodmap: c.mySourceFodmap,
    histamineSources: [],
    fodmapSources: [],
    histamineReliability: c.histamineLevel === 'inconnu' ? 'inconnue' : 'utilisateur',
    fodmapReliability: c.fodmapLevel === 'inconnu' ? 'inconnue' : 'utilisateur',
    overridden: [],
    seedChanged: [],
    modifiedAt: c.updatedAt,
    needsCompletion: needsCompletion(c),
  }
}

/** Valeur du seed pour un champ (ce que « revenir à la valeur d'origine » restaure). */
export function seedFieldValue(seed: SeedFoodRecord, field: OverridableField): unknown {
  if (field === 'mySourceHistamine' || field === 'mySourceFodmap') return ''
  return (seed as unknown as Record<string, unknown>)[field]
}
