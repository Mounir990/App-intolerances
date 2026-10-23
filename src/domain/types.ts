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
  /** Note libre (facultative). */
  note?: string
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
  /** Douleur pelvienne ou douleur à la jambe (les côtés gauche/droit sont dans `zones`). */
  region: 'pelvic' | 'leg'
  /** Facultatif : on peut noter une douleur sans la qualifier. */
  painType?: 'cramping' | 'stabbing' | 'burning' | 'pressure' | 'dull' | 'other'
  /** 1-10 */
  intensity: number
  zones: { view: BodyView; zone: string }[]
}

/**
 * Les entrées de symptômes pointent vers le CATALOGUE par `kind` : identifiant d'un symptôme de base
 * (« bloating ») ou d'un symptôme créé par l'utilisatrice (« custom:… »). Voir domain/symptoms.ts.
 */
export type GyneKind = 'bleeding' | 'painDefecation' | 'painUrination' | 'endoBelly' | 'dyspareunia'
export interface GyneEvent extends Stamped {
  kind: string
  bleedingType?: 'spotting' | 'light' | 'medium' | 'heavy' | 'clots'
  /** 1-10, pour les symptômes de l'échelle gynéco. */
  intensity?: number
  durationMin?: number
}

export type DigestiveKind =
  | 'pain' | 'bloating' | 'distension' | 'belching' | 'gas'
  | 'acidity' | 'nausea' | 'stool' | 'immediateReaction'
export interface DigestiveEntry extends Stamped {
  kind: string
  /** 1-5 */
  intensity?: number
  durationMin?: number
  /** Localisation d'une douleur/crampe (zone de l'abdomen). */
  location?: string
  /** Douleur soulagée par le passage aux toilettes. */
  reliefByToilet?: boolean
  /** Échelle de Bristol 1-7 (kind = 'stool'). */
  bristol?: number
  /** Nombre de selles (kind = 'stool'). */
  count?: number
  /** Réaction immédiate : urgence ou diarrhée peu après un repas. */
  reaction?: 'urgency' | 'diarrhea'
  /** Délai après le repas, en minutes (réaction immédiate). */
  minutesAfterMeal?: number
}

export type ExtraGroup = 'skin' | 'orl' | 'other'
export type ExtraKind =
  | 'itching' | 'hives' | 'flush' | 'eczema'
  | 'nasalCongestion' | 'runnyNose' | 'sneezing' | 'itchyThroatEars'
  | 'migraine' | 'urinary' | 'breathingDifficulty' | 'lipThroatSwelling' | 'faintness'
export interface ExtraEntry extends Stamped {
  group: ExtraGroup
  kind: string
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
  /** Nombre de réveils dus à la douleur. */
  painWakeups?: number
  activity?: string
  activityMinutes?: number
  /** médicament ou complément (l'heure de prise est `ts`) */
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
