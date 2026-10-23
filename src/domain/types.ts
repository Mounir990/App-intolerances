/**
 * Types du domaine : tout ce qui est stocké dans IndexedDB.
 *
 * Règles de modélisation (pensées pour les phases 2 et 3) :
 *  - chaque enregistrement du journal porte `ts` (epoch ms, précis à la minute)
 *    et `date` (jour local AAAA-MM-JJ, indexé) ;
 *  - les aliments sont référencés par `foodId`, jamais par texte libre seul ;
 *  - le jour/la phase du cycle ne sont PAS stockés : ils sont calculés (domain/cycle.ts).
 */

export type Lang = 'es' | 'fr'
export type Localized = Record<Lang, string>
export type Id = string

/** Champs communs à toute entrée datée du journal. */
export interface Stamped {
  id: Id
  /** Instant précis de l'événement (epoch ms). */
  ts: number
  /** Jour local de `ts`, format AAAA-MM-JJ. */
  date: string
  createdAt: number
  updatedAt: number
}

// ───────────────────────── Aliments ─────────────────────────

/** Fiabilité de la fiche : on n'invente jamais de valeur, dans le doute → unknown. */
export type Confidence = 'confirmed' | 'approximate' | 'unknown'
export type Tri = 'yes' | 'no' | 'unknown'
export type Level = 'low' | 'medium' | 'high' | 'unknown'
export type FodmapType = 'fructose' | 'lactose' | 'polyols' | 'fructans' | 'gos'

export interface FoodTags {
  gluten: Tri
  dairy: Tri
  /** Pertinent seulement si dairy = 'yes'. */
  lactose: Tri
  egg: Tri
  fodmap: { level: Level; types: FodmapType[] }
  histamine: Level
  histamineLiberator: Tri
  daoInhibitor: Tri
  solanaceae: Tri
  /** Allergène croisé du syndrome latex-fruits. */
  latexFruit: Tri
}

export interface Food {
  /** Identifiant stable (ex. « banana »). Les aliments perso : « custom:<uuid> ». */
  id: Id
  name: Localized
  /** Synonymes pour la recherche, par langue. */
  aliases?: Partial<Record<Lang, string[]>>
  category: string
  tags: FoodTags
  confidence: Confidence
  source: 'builtin' | 'custom'
  /** Pour les aliments perso : le nom n'a été saisi que dans une langue. */
  nameLang?: Lang
  /** Émoji d'affichage (personnalisable). */
  emoji?: string
  /** Masqué dans la recherche et les listes (jamais supprimé : l'historique le référence). */
  hidden?: boolean
  /** Références (clés de `sources` dans foods.json) ayant servi à remplir les étiquettes. */
  sources?: string[]
  /** Précision humaine : portion, préparation, désaccord entre sources… */
  note?: Localized
}

export interface RecipeItem { foodId: Id; qty?: string }
/** Plat composé réutilisable (ex. lasagnes) : seule façon de l'analyser. */
export interface Recipe {
  id: Id
  name: Localized
  nameLang?: Lang
  items: RecipeItem[]
  source: 'builtin' | 'custom'
  emoji?: string
  hidden?: boolean
  favorite: boolean
  createdAt: number
  updatedAt: number
}

// ───────────────────────── Journal ─────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'other'

export type MealItem =
  | { kind: 'food'; foodId: Id; qty?: string }
  | { kind: 'recipe'; recipeId: Id }
  /** Texte libre sans ingrédients : affiché « non analysé ». */
  | { kind: 'free'; text: string }

export interface Meal extends Stamped {
  type: MealType
  items: MealItem[]
  note?: string
  favorite?: boolean
  /** Alertes d'allergie vues et acceptées avant l'enregistrement. */
  acknowledgedAlerts?: Id[]
}

/** Jour 1 des règles. Les jours/phases sont déduits de ces dates. */
export interface CycleStart extends Stamped {
  /** Longueur de cycle observée/estimée pour ce cycle (sinon valeur des réglages). */
  cycleLength?: number
}

export type BodyView = 'front' | 'back'
export interface PainEntry extends Stamped {
  painType: 'cramping' | 'stabbing' | 'burning' | 'pressure' | 'dull' | 'other'
  /** 1-10 */
  intensity: number
  zones: { view: BodyView; zone: string }[]
}

export type GyneKind =
  | 'bleeding'
  | 'painDefecation' // douleur lancinante à la défécation pendant les règles
  | 'painUrination' // idem à la miction
  | 'endoBelly' // distension massive non liée à l'alimentation
  | 'dyspareunia'
export interface GyneEvent extends Stamped {
  kind: GyneKind
  bleedingType?: 'spotting' | 'light' | 'medium' | 'heavy' | 'clots'
  /** 1-10, pour les symptômes douloureux. */
  intensity?: number
}

export type DigestiveKind =
  | 'pain' | 'bloating' | 'distension' | 'belching' | 'gas'
  | 'acidity' | 'nausea' | 'stool' | 'immediateReaction'
export interface DigestiveEntry extends Stamped {
  kind: DigestiveKind
  /** 1-5 */
  intensity?: number
  location?: string
  reliefByToilet?: boolean
  /** Échelle de Bristol 1-7 (kind = 'stool'). */
  bristol?: number
  /** Nombre de selles (kind = 'stool'). */
  count?: number
  /** Réaction immédiate : urgence ou diarrhée peu après un repas. */
  reaction?: 'urgency' | 'diarrhea'
  /** Repas lié, si l'utilisatrice l'indique (sinon la phase 2 déduira par l'horodatage). */
  mealId?: Id
}

export type ExtraGroup = 'skin' | 'orl' | 'other'
export type ExtraKind =
  | 'itching' | 'hives' | 'flush' | 'eczema'
  | 'nasalCongestion' | 'runnyNose' | 'sneezing' | 'itchyThroatEars'
  | 'migraine' | 'urinary'
export interface ExtraEntry extends Stamped {
  group: ExtraGroup
  kind: ExtraKind
  /** `ts` = heure de début. 1-5 */
  intensity: number
  durationMin?: number
}

export type ContextKind = 'stress' | 'sleep' | 'activity' | 'medication'
export interface ContextEntry extends Stamped {
  kind: ContextKind
  /** stress 1-5 */
  stress?: number
  sleepHours?: number
  /** qualité du sommeil 1-5 */
  sleepQuality?: number
  painWakeups?: number
  activity?: string
  /** médicament ou complément */
  medName?: string
}

/**
 * Statut d'une journée (clé = date locale). Une journée « terminée » est considérée comme
 * complète : la phase 2 (analyses) ne l'utilisera qu'à cette condition, pour ne pas
 * confondre « rien ressenti » et « rien noté ».
 */
export interface DayRecord {
  date: string
  completed: boolean
  completedAt?: number
  note?: string
}

// ───────────────────────── Réglages ─────────────────────────

/** Allergie confirmée de l'utilisatrice. */
export interface AllergyEntry {
  id: Id
  foodId: Id
  label: Localized
  /** Alerter aussi sur les aliments à réactivité croisée (syndrome latex-fruits). */
  crossReactive: boolean
}

/** Famille d'aliments surveillée (ex. solanacées), liste d'aliments éditable. */
export interface WatchedFamily {
  id: Id
  label: Localized
  foodIds: Id[]
  foodLabels: Localized[]
}

export interface Profile {
  allergies: AllergyEntry[]
  watchedFamilies: WatchedFamily[]
}

export interface AppSettings {
  lang: Lang
  /** Longueur de cycle par défaut (jours). */
  cycleLength: number
  /** Durée de menstruation estimée (jours). */
  periodLength: number
  profile: Profile
}
