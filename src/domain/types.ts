/**
 * Types du domaine : tout ce qui est stocké dans IndexedDB.
 *
 * Règles de modélisation (pensées pour les phases 2 et 3) :
 *  - chaque enregistrement du journal porte `ts` (epoch ms, précis à la minute)
 *    et `date` (jour local AAAA-MM-JJ, indexé) ;
 *  - les aliments sont référencés par `foodId`, jamais par texte libre seul ;
 *  - le jour/la phase du cycle ne sont PAS stockés : ils sont calculés (domain/cycle.ts).
 */

import type { AllergenFlag } from './foods'

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

// ───────────────────────── Recettes ─────────────────────────
// (le modèle des aliments est dans domain/foods.ts)

export interface RecipeItem { foodId: Id; qty?: string }
/** Plat composé réutilisable (ex. lasagnes) : seule façon de l'analyser. */
/** « Recette maison » : composition connue. « Recette restaurant » : composition estimée (ingrédients cachés possibles). */
export type RecipeKind = 'home' | 'restaurant'

export interface Recipe {
  id: Id
  name: string
  kind: RecipeKind
  /** Nom du restaurant (facultatif). */
  place?: string
  items: RecipeItem[]
  emoji?: string
  favorite: boolean
  createdAt: number
  updatedAt: number
}

// ───────────────────────── Journal ─────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'tea' | 'dinner' | 'snack'

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
  /** Douleur pelvienne ou douleur à la jambe (côté gauche/droit/les deux dans `zones`). */
  region: 'pelvic' | 'leg'
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
  /** « Autre symptôme » : tout ce qui ne rentre dans aucune catégorie, nommé par l'utilisatrice (`label`). */
  | 'other'
export interface ExtraEntry extends Stamped {
  /** Nom libre, pour kind = 'other'. */
  label?: string
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

/**
 * Profil d'alerte. Les ALLERGIES PERSONNELLES ne sont plus stockées ici : ce sont les
 * aliments dont le champ « alerte_perso » (valeur effective) vaut « allergene_confirme »,
 * modifiable depuis chaque fiche aliment.
 */
export interface Profile {
  /** Étiquettes/familles à signaler dans chaque repas (ex. solanaceae). */
  watchedFlags: AllergenFlag[]
}

export interface AppSettings {
  lang: Lang
  /** Apparence : suit le téléphone, clair, ou sombre doux (migraines). */
  theme: 'auto' | 'light' | 'dark'
  /** Catégories masquées sur l'écran « Aujourd'hui » (masquer ne supprime rien). */
  hiddenCategories: string[]
  /** Longueur de cycle par défaut (jours). */
  cycleLength: number
  /** Durée de menstruation estimée (jours). */
  periodLength: number
  profile: Profile
}
