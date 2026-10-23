import { parseCsv, toCsv } from './csv'
import {
  DAO_VALUES, EXPORT_EXTRA_COLUMNS, FODMAP_LEVELS, FODMAP_TYPE_VOCABULARY, FOOD_COLUMNS,
  HISTAMINE_LEVELS, LIBERATOR_VALUES, PERSONAL_ALERT_VALUE, SEED_RELIABILITIES,
  type EffectiveFood, type SeedFood,
} from './foods'

export interface ParsedSeed {
  foods: SeedFood[]
  /** Lignes ignorées (invalides ou doublons) : jamais importées, toujours signalées. */
  rejected: { line: number; id?: string; reasons: string[] }[]
  /** Incohérences non bloquantes (la ligne est importée). */
  warnings: { line: number; id?: string; message: string }[]
  /** Erreur globale (en-tête incorrect) : rien n'est importé. */
  fatal?: string
}

const ID_RE = /^[a-z0-9_]+$/
const SOURCE_RE = /^S\d+$/
const oneOf = <T extends string>(list: readonly T[], v: string): v is T => (list as readonly string[]).includes(v)
const splitList = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)

/**
 * Parse et valide le CSV d'origine. Ne lève jamais : tout problème est rapporté dans
 * `rejected` / `warnings` / `fatal`, pour qu'une ligne cassée n'empêche pas le reste.
 */
export function parseSeedCsv(text: string): ParsedSeed {
  const out: ParsedSeed = { foods: [], rejected: [], warnings: [] }
  const rows = parseCsv(text)
  if (rows.length === 0) return { ...out, fatal: 'Fichier vide' }

  const header = rows[0].cells.map((c) => c.trim())
  if (header.length !== FOOD_COLUMNS.length || FOOD_COLUMNS.some((c, i) => header[i] !== c)) {
    return { ...out, fatal: `En-tête inattendu (attendu : ${FOOD_COLUMNS.join(',')})` }
  }

  const seen = new Map<string, number>()
  for (const { line, cells } of rows.slice(1)) {
    const id = cells[0]?.trim() || undefined
    const reasons: string[] = []
    if (cells.length !== FOOD_COLUMNS.length) {
      out.rejected.push({ line, id, reasons: [`${cells.length} colonnes au lieu de ${FOOD_COLUMNS.length}`] })
      continue
    }
    const [
      _id, categorie, nomFr, nomEs, alertePerso, histNiveau, histDetail, liberateur, dao, autresAmines,
      histSources, histFiab, fodNiveau, fodPortion, fodTypes, fodSources, fodFiab, remarque, aCompleter,
    ] = cells.map((c) => c.trim())

    if (!id || !ID_RE.test(id)) reasons.push(`id invalide : « ${_id} »`)
    else if (seen.has(id)) reasons.push(`id en double (déjà ligne ${seen.get(id)})`)
    if (!categorie) reasons.push('catégorie vide')
    if (!nomFr) reasons.push('nom_fr vide')
    if (!nomEs) reasons.push('nom_es vide')
    if (alertePerso !== '' && alertePerso !== PERSONAL_ALERT_VALUE) reasons.push(`alerte_perso invalide : « ${alertePerso} »`)
    if (!oneOf(HISTAMINE_LEVELS, histNiveau)) reasons.push(`histamine_niveau invalide : « ${histNiveau} »`)
    if (!oneOf(LIBERATOR_VALUES, liberateur)) reasons.push(`liberateur invalide : « ${liberateur} »`)
    if (!oneOf(DAO_VALUES, dao)) reasons.push(`dao invalide : « ${dao} »`)
    if (!oneOf(SEED_RELIABILITIES, histFiab)) reasons.push(`histamine_fiabilite invalide : « ${histFiab} »`)
    if (!oneOf(FODMAP_LEVELS, fodNiveau)) reasons.push(`fodmap_niveau invalide : « ${fodNiveau} »`)
    if (!oneOf(SEED_RELIABILITIES, fodFiab)) reasons.push(`fodmap_fiabilite invalide : « ${fodFiab} »`)
    if (aCompleter !== 'oui' && aCompleter !== 'non') reasons.push(`a_completer invalide : « ${aCompleter} »`)

    if (reasons.length > 0) { out.rejected.push({ line, id, reasons }); continue }
    seen.set(id!, line)

    const food: SeedFood = {
      id: id!, category: categorie, nameFr: nomFr, nameEs: nomEs,
      personalAlert: alertePerso as SeedFood['personalAlert'],
      histamineLevel: histNiveau as SeedFood['histamineLevel'],
      histamineDetail: histDetail,
      liberator: liberateur as SeedFood['liberator'],
      dao: dao as SeedFood['dao'],
      otherAmines: autresAmines,
      histamineSources: splitList(histSources),
      histamineReliability: histFiab as SeedFood['histamineReliability'],
      fodmapLevel: fodNiveau as SeedFood['fodmapLevel'],
      fodmapPortion: fodPortion,
      fodmapTypes: splitList(fodTypes),
      fodmapSources: splitList(fodSources),
      fodmapReliability: fodFiab as SeedFood['fodmapReliability'],
      remark: remarque,
      toComplete: aCompleter === 'oui',
    }
    out.foods.push(food)
    for (const message of checkCoherence(food)) out.warnings.push({ line, id: food.id, message })
  }
  return out
}

/** Incohérences internes à une ligne valide (anomalies à signaler, pas à corriger en silence). */
export function checkCoherence(f: SeedFood): string[] {
  const w: string[] = []
  const unknownValues = f.histamineLevel === 'inconnu' || f.liberator === 'inconnu' || f.fodmapLevel === 'inconnu'
  if (unknownValues !== f.toComplete) {
    w.push(`a_completer=${f.toComplete ? 'oui' : 'non'} mais ${unknownValues ? 'au moins une valeur est inconnue' : 'aucune valeur inconnue'}`)
  }
  if (f.histamineLevel === 'inconnu' && f.histamineReliability !== 'inconnue') {
    w.push(`histamine inconnue mais fiabilité « ${f.histamineReliability} »`)
  }
  if (f.histamineLevel !== 'inconnu' && f.histamineReliability === 'inconnue') {
    w.push('histamine renseignée mais fiabilité « inconnue »')
  }
  if (f.histamineLevel !== 'inconnu' && f.histamineSources.length === 0) w.push('histamine renseignée sans source')
  if (f.fodmapLevel === 'inconnu' && f.fodmapReliability !== 'inconnue') {
    w.push(`FODMAP inconnu mais fiabilité « ${f.fodmapReliability} »`)
  }
  if (f.fodmapLevel !== 'inconnu' && f.fodmapReliability === 'inconnue') {
    w.push('FODMAP renseigné mais fiabilité « inconnue »')
  }
  if (f.fodmapLevel !== 'inconnu' && f.fodmapSources.length === 0) w.push('FODMAP renseigné sans source')
  if (f.fodmapLevel === 'bas_selon_portion' && !f.fodmapPortion) w.push('FODMAP « bas selon portion » sans portion de référence')
  if (f.fodmapLevel === 'eleve' && f.fodmapTypes.length === 0) w.push('FODMAP élevé sans type indiqué')
  for (const s of [...f.histamineSources, ...f.fodmapSources]) {
    if (!SOURCE_RE.test(s)) w.push(`code de source inattendu : « ${s} »`)
  }
  for (const t of f.fodmapTypes) {
    const base = t.replace(/\s*\(.*\)\s*$/, '').trim()
    if (!(FODMAP_TYPE_VOCABULARY as readonly string[]).includes(base)) w.push(`type de FODMAP hors vocabulaire : « ${t} »`)
  }
  return w
}

/**
 * Export CSV de la base EFFECTIVE (seed + modifications + ajouts perso).
 * Les 19 premières colonnes sont identiques au fichier d'origine ; la fiabilité
 * « vérifiée par moi » s'écrit `utilisateur`. 4 colonnes supplémentaires suivent.
 */
export function exportEffectiveCsv(foods: EffectiveFood[]): string {
  const header = [...FOOD_COLUMNS, ...EXPORT_EXTRA_COLUMNS] as string[]
  const rows = foods.map((f) => [
    f.id, f.category, f.nameFr, f.nameEs, f.personalAlert,
    f.histamineLevel, f.histamineDetail, f.liberator, f.dao, f.otherAmines,
    f.histamineSources.join(','), f.histamineReliability,
    f.fodmapLevel, f.fodmapPortion, f.fodmapTypes.join(', '), f.fodmapSources.join(','), f.fodmapReliability,
    f.remark, f.needsCompletion ? 'oui' : 'non',
    f.mySourceHistamine, f.mySourceFodmap, f.flags.join(' '),
    f.modifiedAt ? new Date(f.modifiedAt).toISOString() : '',
  ])
  return toCsv([header, ...rows])
}
