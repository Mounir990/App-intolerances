import { fodmapRank, histamineRank, isLiberator, maxKnown } from './effective'
import {
  PERSONAL_ALERT_VALUE, type AllergenFlag, type EffectiveFood, type FodmapLevel, type HistamineLevel,
} from './foods'
import { dropContained, findSpans, keywordRegex, normalize } from './text'
import type { MealItem } from './types'

/** Allergènes « déclarés » reconnus dans un texte d'étiquette (les 14 de l'UE + familles surveillées). */
export type DeclaredAllergen = AllergenFlag | 'lupin' | 'sulphites'

/** Mots-clés FR + ES (saisis sans accent : la normalisation les traite de toute façon). */
const DECLARED_KEYWORDS: Record<DeclaredAllergen, string[]> = {
  gluten: ['gluten', 'blé', 'froment', 'seigle', 'orge', 'avoine', 'épeautre', 'kamut', 'triticale', 'semoule', 'boulgour', 'seitan', 'malt',
    'trigo', 'centeno', 'cebada', 'avena', 'espelta', 'sémola', 'malta'],
  dairy: ['lait', 'lactose', 'lactosérum', 'caséine', 'caséinate', 'beurre', 'crème', 'fromage', 'yaourt', 'yogourt', 'babeurre', 'lactoglobuline',
    'leche', 'lactosa', 'suero de leche', 'caseína', 'caseinato', 'mantequilla', 'nata', 'queso', 'yogur', 'lactoglobulina'],
  egg: ['oeuf', 'œuf', 'albumine', 'lysozyme', 'ovalbumine', 'huevo', 'albúmina', 'lisozima', 'ovoalbúmina', 'yema'],
  fish: ['poisson', 'saumon', 'thon', 'sardine', 'anchois', 'morue', 'cabillaud', 'merlu', 'maquereau', 'colin', 'truite', 'surimi',
    'pescado', 'salmón', 'atún', 'anchoa', 'bacalao', 'merluza', 'caballa', 'trucha'],
  crustaceans: ['crustacés', 'crevette', 'crabe', 'homard', 'langoustine', 'langouste', 'gambas', 'langostino', 'camarón', 'cangrejo', 'bogavante', 'crustáceos'],
  molluscs: ['mollusques', 'moule', 'calmar', 'calamar', 'poulpe', 'huître', 'mejillón', 'pulpo', 'ostra', 'almeja', 'molusco', 'coquille saint-jacques'],
  peanut: ['arachide', 'cacahuète', 'cacahuete', 'cacahuate', 'maní'],
  tree_nuts: ['fruits à coque', 'amande', 'noisette', 'noix', 'cajou', 'pistache', 'macadamia', 'pécan', 'noix du brésil',
    'frutos de cáscara', 'almendra', 'avellana', 'nuez', 'anacardo', 'pistacho'],
  soy: ['soja', 'soya', 'tofu', 'tempeh', 'miso', 'edamame'],
  celery: ['céleri', 'apio'],
  mustard: ['moutarde', 'mostaza'],
  sesame: ['sésame', 'sésamo', 'tahini', 'tahin'],
  lupin: ['lupin', 'altramuz'],
  sulphites: ['sulfites', 'sulfitos', 'anhydride sulfureux', 'dioxyde de soufre', 'dióxido de azufre', 'e220', 'e221', 'e222', 'e223', 'e224', 'e226', 'e227', 'e228'],
  solanaceae: ['solanacée', 'solanácea', 'paprika', 'pimentón', 'piment', 'cayenne', 'chili', 'guindilla', 'tomate', 'poivron', 'pimiento',
    'aubergine', 'berenjena', 'pomme de terre', 'patata', 'fécule de pomme de terre', 'goji'],
  latex_fruit: [],
  latex_fruit_weak: [],
}

/** Expressions qui ressemblent à un allergène sans en être un (lait végétal, « sans gluten »…). */
const DECLARED_MASKS: [RegExp, string][] = [
  [/(?<![a-z])sans gluten(?![a-z])|(?<![a-z])sin gluten(?![a-z])/g, ' '],
  [/(?<![a-z])sans lactose(?![a-z])|(?<![a-z])sin lactosa(?![a-z])/g, ' '],
  [/(?<![a-z])sans oeufs?(?![a-z])|(?<![a-z])sin huevos?(?![a-z])/g, ' '],
  [/(?<![a-z])(?:noix|nuez) de (?:coco|muscade|moscada)(?![a-z])/g, ' '],
  [/(?<![a-z])(?:lait|leche) de (?=(?:soja|soya|coco|amande|almendras?|avoine|avena|riz|arroz|noisette|avellana|chataigne|castana)(?![a-z]))/g, ' '],
  [/(?<![a-z])(?:creme|nata) de (?=(?:coco|soja|soya|riz|arroz|amande|almendras?|avoine|avena)(?![a-z]))/g, ' '],
  [/(?<![a-z])(?:beurre|mantequilla) de (?=(?:cacahuete|cacahuate|mani|cacao|karite|coco|amande|almendras?|noisette|avellana|sesame)(?![a-z]))/g, ' '],
]

const TRACE_RE = /(?<![a-z])(?:traces?|trazas?|peut contenir|puede contener|pueden contener|may contain)(?![a-z])/

interface Matcher { key: string; keyword: string; re: RegExp }
const DECLARED_MATCHERS: (Matcher & { flag: DeclaredAllergen })[] = (
  Object.entries(DECLARED_KEYWORDS) as [DeclaredAllergen, string[]][]
).flatMap(([flag, words]) =>
  words.map((w) => {
    const keyword = normalize(w)
    return { flag, key: flag, keyword, re: keywordRegex(keyword) }
  }),
)

// ───────────────────────── Contexte de détection ─────────────────────────

export interface RecipeLike { id: string; kind?: 'home' | 'restaurant'; items: { foodId: string }[] }

export interface DetectionContext {
  foods: EffectiveFood[]
  byId: Map<string, EffectiveFood>
  /** Aliments marqués « allergène personnel » (valeur effective, donc modifiable). */
  personal: EffectiveFood[]
  personalIds: Set<string>
  /** Vrai si au moins un allergène personnel est un fruit du syndrome latex-fruits. */
  crossReactive: boolean
  watchedFlags: AllergenFlag[]
  recipes: Map<string, RecipeLike>
  foodMatchers: Matcher[]
  personalMatchers: Matcher[]
}

export interface ContextInput {
  foods: EffectiveFood[]
  recipes?: RecipeLike[]
  watchedFlags?: AllergenFlag[]
  /** Mots désignant des dérivés d'un aliment (guacamole → avocat), par id d'aliment. */
  derivatives?: Record<string, string[]>
  /** Aliments jamais cherchés dans un texte (ex. « eau », présent dans toute liste d'ingrédients). */
  excludedFromTextDetection?: string[]
}

/** Mots-clés (normalisés) qui désignent un aliment : noms FR/ES, parties d'un « A / B », synonymes. */
export function foodKeywords(food: EffectiveFood, extra: string[] = []): string[] {
  const out = new Set<string>()
  const add = (raw: string) => {
    const n = normalize(raw)
    if (n) out.add(n)
    const noParen = normalize(raw.replace(/\(.*?\)/g, ' '))
    if (noParen) out.add(noParen)
  }
  for (const name of [food.nameFr, food.nameEs]) for (const part of name.split(' / ')) add(part)
  for (const a of food.aliases) add(a)
  for (const e of extra) add(e)
  return [...out]
}

export function buildContext(input: ContextInput): DetectionContext {
  const { foods, recipes = [], watchedFlags = [], derivatives = {}, excludedFromTextDetection = [] } = input
  const personal = foods.filter((f) => f.personalAlert === PERSONAL_ALERT_VALUE)
  const personalIds = new Set(personal.map((f) => f.id))
  const excluded = new Set(excludedFromTextDetection)

  const matchersFor = (list: EffectiveFood[], withDerivatives: boolean): Matcher[] =>
    list.flatMap((f) =>
      foodKeywords(f, withDerivatives ? derivatives[f.id] ?? [] : []).map((keyword) => ({
        key: f.id, keyword, re: keywordRegex(keyword),
      })),
    )

  return {
    foods,
    byId: new Map(foods.map((f) => [f.id, f])),
    personal,
    personalIds,
    crossReactive: personal.some((f) => f.flags.includes('latex_fruit')),
    watchedFlags,
    recipes: new Map(recipes.map((r) => [r.id, r])),
    personalMatchers: matchersFor(personal, true),
    foodMatchers: matchersFor(foods.filter((f) => !personalIds.has(f.id) && !excluded.has(f.id)), false),
  }
}

// ───────────────────────── Autocomplétion ─────────────────────────

/**
 * Suggestions d'aliments. Les allergènes personnels n'y figurent JAMAIS : on ne
 * propose pas à l'utilisatrice d'ajouter un aliment auquel elle est allergique.
 * (Si elle le tape en texte libre, scanText() le détecte et déclenche l'alerte.)
 */
export function searchFoods(query: string, ctx: DetectionContext, limit = 20): EffectiveFood[] {
  const q = normalize(query)
  if (!q) return []
  const scored: { food: EffectiveFood; score: number }[] = []
  for (const food of ctx.foods) {
    if (ctx.personalIds.has(food.id)) continue
    let best = 0
    for (const kw of foodKeywords(food)) {
      if (kw.startsWith(q)) best = Math.max(best, 100 - Math.min(kw.length - q.length, 50) / 10)
      else if (kw.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 60)
      else if (kw.includes(q)) best = Math.max(best, 30)
    }
    if (best > 0) scored.push({ food, score: best })
  }
  return scored.sort((a, b) => b.score - a.score || a.food.nameFr.localeCompare(b.food.nameFr)).slice(0, limit).map((s) => s.food)
}

// ───────────────────────── Alertes ─────────────────────────

export type AlertKind = 'personal' | 'cross_latex' | 'cross_latex_weak' | 'watched'

export interface FoodAlert {
  /**
   * personal = allergène confirmé (rouge) ; cross_latex = réactivité croisée à forte littérature ;
   * cross_latex_weak = réactivité croisée possible, preuve plus faible (alerte douce) ; watched = famille surveillée.
   */
  kind: AlertKind
  foodId?: string
  flag?: DeclaredAllergen
  /** Mot trouvé dans le texte, si l'alerte vient d'un texte libre / d'une étiquette. */
  matched?: string
  /** « peut contenir des traces de… » */
  trace?: boolean
  via: 'food' | 'text'
}

const SEVERITY: Record<AlertKind, number> = { personal: 0, cross_latex: 1, cross_latex_weak: 2, watched: 3 }

function dedupeAlerts(alerts: FoodAlert[]): FoodAlert[] {
  const map = new Map<string, FoodAlert>()
  for (const a of alerts) {
    const key = `${a.kind}|${a.foodId ?? ''}|${a.flag ?? ''}`
    const prev = map.get(key)
    if (!prev || (prev.trace && !a.trace)) map.set(key, a)
  }
  const all = [...map.values()]
  // Une alerte de famille sans aliment (« paprika » repéré dans l'étiquette) fait doublon si un aliment
  // de la même famille a déjà été reconnu dans le même texte : on garde la plus précise.
  const familiesWithFood = new Set(all.filter((a) => a.kind === 'watched' && a.foodId).map((a) => a.flag))
  return all
    .filter((a) => !(a.kind === 'watched' && !a.foodId && familiesWithFood.has(a.flag)))
    .sort((a, b) => SEVERITY[a.kind] - SEVERITY[b.kind])
}

function alertsForFood(food: EffectiveFood, ctx: DetectionContext, via: 'food' | 'text', matched?: string, trace?: boolean): FoodAlert[] {
  const out: FoodAlert[] = []
  if (ctx.personalIds.has(food.id)) {
    out.push({ kind: 'personal', foodId: food.id, via, matched, trace })
    return out
  }
  // Un aliment créé par l'utilisatrice (« chips de banane ») ne porte pas l'alerte de l'aliment dont il dérive :
  // on cherche donc ses allergènes personnels dans son NOM, pour qu'il ne contourne jamais l'alerte.
  if (food.origin === 'custom') {
    const names = normalize(`${food.nameFr}. ${food.nameEs}`)
    for (const m of ctx.personalMatchers) {
      const found = findSpans(names, m.re)
      if (found.length) out.push({ kind: 'personal', foodId: m.key, via: 'text', matched: found[0].text })
    }
    if (out.length) return out
  }
  if (ctx.crossReactive && food.flags.includes('latex_fruit')) out.push({ kind: 'cross_latex', foodId: food.id, via, matched, trace })
  else if (ctx.crossReactive && food.flags.includes('latex_fruit_weak')) out.push({ kind: 'cross_latex_weak', foodId: food.id, via, matched, trace })
  for (const flag of ctx.watchedFlags) {
    if (flag !== 'latex_fruit' && flag !== 'latex_fruit_weak' && food.flags.includes(flag)) out.push({ kind: 'watched', foodId: food.id, flag, via, matched, trace })
  }
  return out
}

// ───────────────────────── Détection dans un texte / une étiquette ─────────────────────────

export interface TextHit { key: string; matched: string; trace: boolean }

export interface TextScan {
  /** Allergènes personnels trouvés (clé = id de l'aliment). */
  personal: TextHit[]
  /** Aliments de la base trouvés (clé = id). */
  foods: TextHit[]
  /** Allergènes déclarés (clé = DeclaredAllergen). */
  declared: TextHit[]
  alerts: FoodAlert[]
}

function mergeHits(into: Map<string, TextHit>, hit: TextHit) {
  const prev = into.get(hit.key)
  if (!prev || (prev.trace && !hit.trace)) into.set(hit.key, hit)
}

/**
 * Analyse un texte saisi ou collé (liste d'ingrédients, nom de plat).
 * Insensible à la casse et aux accents ; FR + ES ; pluriels ; mentions « traces » repérées
 * par phrase (segments séparés par . ; ou retour à la ligne).
 */
export function scanText(text: string, ctx: DetectionContext): TextScan {
  const personal = new Map<string, TextHit>()
  const foods = new Map<string, TextHit>()
  const declared = new Map<string, TextHit>()

  for (const segment of text.split(/[.;\n]+/)) {
    const n = normalize(segment)
    if (!n) continue
    const trace = TRACE_RE.test(n)

    for (const m of ctx.personalMatchers) {
      const spans = findSpans(n, m.re)
      if (spans.length) mergeHits(personal, { key: m.key, matched: spans[0].text, trace })
    }

    const spans = ctx.foodMatchers.flatMap((m) => findSpans(n, m.re).map((s) => ({ ...s, key: m.key })))
    for (const s of dropContained(spans)) mergeHits(foods, { key: s.key, matched: s.text, trace })

    const masked = DECLARED_MASKS.reduce((t, [re, rep]) => t.replace(re, rep), n)
    for (const m of DECLARED_MATCHERS) {
      const found = findSpans(masked, m.re)
      if (found.length) mergeHits(declared, { key: m.flag, matched: found[0].text, trace })
    }
  }

  const alerts: FoodAlert[] = []
  for (const h of personal.values()) {
    alerts.push({ kind: 'personal', foodId: h.key, matched: h.matched, trace: h.trace, via: 'text' })
  }
  for (const h of foods.values()) {
    const food = ctx.byId.get(h.key)
    if (food) alerts.push(...alertsForFood(food, ctx, 'text', h.matched, h.trace))
  }
  for (const h of declared.values()) {
    const flag = h.key as DeclaredAllergen
    if ((ctx.watchedFlags as string[]).includes(flag) && flag !== 'latex_fruit' && flag !== 'latex_fruit_weak') {
      alerts.push({ kind: 'watched', flag, matched: h.matched, trace: h.trace, via: 'text' })
    }
  }
  return {
    personal: [...personal.values()],
    foods: [...foods.values()],
    declared: [...declared.values()],
    alerts: dedupeAlerts(alerts),
  }
}

// ───────────────────────── Analyse d'un repas ─────────────────────────

export interface MealLabels {
  /** Étiquettes allergènes présentes (union des aliments). */
  flags: AllergenFlag[]
  /** Lactose présent (type FODMAP « lactose » d'au moins un aliment). */
  lactose: boolean
  histamine: {
    /** Niveau le plus élevé parmi les aliments CONNUS ; null si aucun n'est connu (jamais « bas » par défaut). */
    max: HistamineLevel | null
    /** Au moins un aliment a une histamine inconnue : le résultat est incomplet. */
    hasUnknown: boolean
    liberators: string[]
    liberatorUnknown: string[]
    dao: string[]
  }
  fodmap: { max: FodmapLevel | null; hasUnknown: boolean; types: string[] }
}

export interface MealAnalysis {
  foods: EffectiveFood[]
  /** Textes libres / plats sans ingrédients : signalés « non analysé ». */
  unanalyzed: string[]
  /** Références à des aliments/recettes introuvables (supprimés). */
  missing: string[]
  alerts: FoodAlert[]
  labels: MealLabels
  /** Recettes « restaurant » du repas : leur composition est estimée (ingrédients cachés possibles). */
  restaurantRecipes: string[]
  /** Des valeurs « approximatif » sont en jeu : afficher « détection basée sur la base d'aliments, à vérifier ». */
  needsReview: boolean
  /** Aliments dont une fiche est à compléter (raccourci « Compléter cette fiche »). */
  toComplete: string[]
}

const fodmapBase = (t: string) => t.replace(/\s*\(.*\)\s*$/, '').trim()

export function analyzeMeal(items: MealItem[], ctx: DetectionContext): MealAnalysis {
  const ids: string[] = []
  const unanalyzed: string[] = []
  const missing: string[] = []
  const restaurantRecipes: string[] = []
  const alerts: FoodAlert[] = []
  const addId = (id: string) => { if (!ids.includes(id)) ids.push(id) }

  for (const item of items) {
    if (item.kind === 'food') addId(item.foodId)
    else if (item.kind === 'recipe') {
      const recipe = ctx.recipes.get(item.recipeId)
      if (!recipe) missing.push(item.recipeId)
      else if (recipe.items.length === 0) unanalyzed.push(item.recipeId)
      else {
        recipe.items.forEach((i) => addId(i.foodId))
        if (recipe.kind === 'restaurant') restaurantRecipes.push(recipe.id)
      }
    } else {
      const text = item.text.trim()
      if (!text) continue
      unanalyzed.push(text)
      // Un texte libre n'est pas analysé pour l'histamine/FODMAP, mais la SÉCURITÉ passe avant :
      // on y cherche quand même les allergènes personnels et les familles surveillées.
      alerts.push(...scanText(text, ctx).alerts)
    }
  }

  const foods: EffectiveFood[] = []
  for (const id of ids) {
    const f = ctx.byId.get(id)
    if (!f) { missing.push(id); continue }
    foods.push(f)
    alerts.push(...alertsForFood(f, ctx, 'food'))
  }

  const flags = [...new Set(foods.flatMap((f) => f.flags))]
  const hist = maxKnown(foods.map((f) => f.histamineLevel), histamineRank)
  const fod = maxKnown(foods.map((f) => f.fodmapLevel), fodmapRank)

  return {
    foods,
    unanalyzed,
    missing,
    alerts: dedupeAlerts(alerts),
    labels: {
      flags,
      lactose: foods.some((f) => f.fodmapTypes.some((t) => fodmapBase(t) === 'lactose')),
      histamine: {
        max: hist.level,
        hasUnknown: hist.hasUnknown,
        liberators: foods.filter((f) => isLiberator(f.liberator) === true).map((f) => f.id),
        liberatorUnknown: foods.filter((f) => isLiberator(f.liberator) === null).map((f) => f.id),
        dao: foods.filter((f) => f.dao !== 'non').map((f) => f.id),
      },
      fodmap: {
        max: fod.level,
        hasUnknown: fod.hasUnknown,
        types: [...new Set(foods.flatMap((f) => f.fodmapTypes.map(fodmapBase)))],
      },
    },
    restaurantRecipes,
    // Une recette restaurant est toujours « à vérifier » : on ne maîtrise pas ce qu'il y a dedans.
    needsReview: restaurantRecipes.length > 0 || foods.some((f) => f.histamineReliability === 'approximative' || f.fodmapReliability === 'approximative'),
    toComplete: foods.filter((f) => f.needsCompletion).map((f) => f.id),
  }
}
