/**
 * Modèle de la base d'aliments (histamine / FODMAP / étiquettes allergènes).
 *
 * Les valeurs énumérées gardent EXACTEMENT les codes du fichier CSV d'origine
 * (bas|moyen|eleve|inconnu, signale|non_signale…) pour que l'export CSV reste
 * au même format. L'affichage les traduit (es/fr) ; « inconnu » s'affiche « ? ».
 *
 * Principe central : la base d'origine (seed) n'est jamais modifiée. Les
 * modifications de l'utilisatrice sont stockées à part (foodOverrides), champ par
 * champ ; la valeur effective = modification si elle existe, sinon seed.
 */

export const HISTAMINE_LEVELS = ['bas', 'moyen', 'eleve', 'inconnu'] as const
export type HistamineLevel = (typeof HISTAMINE_LEVELS)[number]

export const FODMAP_LEVELS = ['bas', 'bas_selon_portion', 'eleve', 'inconnu'] as const
export type FodmapLevel = (typeof FODMAP_LEVELS)[number]

export const LIBERATOR_VALUES = ['signale', 'non_signale', 'inconnu'] as const
export type Liberator = (typeof LIBERATOR_VALUES)[number]

export const DAO_VALUES = ['oui', 'signale', 'non'] as const
export type Dao = (typeof DAO_VALUES)[number]

export const SEED_RELIABILITIES = ['confirmee', 'approximative', 'inconnue'] as const
export type SeedReliability = (typeof SEED_RELIABILITIES)[number]
/** Fiabilité effective : « utilisateur » = vérifiée par l'utilisatrice elle-même. */
export type Reliability = SeedReliability | 'utilisateur'

export const PERSONAL_ALERT_VALUE = 'allergene_confirme'
export type PersonalAlert = '' | typeof PERSONAL_ALERT_VALUE

/** Types de FODMAP reconnus (le CSV peut ajouter une précision entre parenthèses). */
export const FODMAP_TYPE_VOCABULARY = [
  'fructose', 'fructanes', 'GOS', 'lactose', 'polyols', 'sorbitol', 'mannitol',
] as const

/**
 * Étiquettes allergènes / familles portées par un aliment.
 * Les 12 premières suivent la liste européenne des allergènes (règlement UE 1169/2011).
 * 'solanaceae' est une famille surveillée ; 'latex_fruit' = syndrome latex-fruits à forte littérature
 * (alerte forte) ; 'latex_fruit_weak' = réactivité croisée possible, preuve plus faible (alerte douce).
 * Convention : seules les étiquettes POSITIVES sont stockées ; l'absence d'étiquette
 * ne veut pas dire « garanti sans » (produits transformés, traces).
 */
export const ALLERGEN_FLAGS = [
  'gluten', 'dairy', 'egg', 'fish', 'crustaceans', 'molluscs', 'peanut',
  'tree_nuts', 'soy', 'celery', 'mustard', 'sesame', 'solanaceae', 'latex_fruit', 'latex_fruit_weak',
] as const
export type AllergenFlag = (typeof ALLERGEN_FLAGS)[number]

/** Colonnes du CSV d'origine, dans l'ordre. */
export const FOOD_COLUMNS = [
  'id', 'categorie', 'nom_fr', 'nom_es', 'alerte_perso',
  'histamine_niveau', 'histamine_detail', 'liberateur', 'dao', 'autres_amines',
  'histamine_sources', 'histamine_fiabilite',
  'fodmap_niveau', 'fodmap_portion', 'fodmap_types', 'fodmap_sources', 'fodmap_fiabilite',
  'remarque', 'a_completer',
] as const

/** Colonnes ajoutées à l'export CSV (après les 19 d'origine, qui restent inchangées). */
export const EXPORT_EXTRA_COLUMNS = [
  'ma_source_histamine', 'ma_source_fodmap', 'etiquettes_allergenes', 'modifie_le',
] as const

/** Champs modifiables par l'utilisatrice, avec leur type. */
export interface FoodFieldValues {
  personalAlert: PersonalAlert
  histamineLevel: HistamineLevel
  histamineDetail: string
  liberator: Liberator
  dao: Dao
  otherAmines: string
  fodmapLevel: FodmapLevel
  fodmapPortion: string
  fodmapTypes: string[]
  remark: string
  flags: AllergenFlag[]
  /** Source libre de l'utilisatrice (texte ou lien), par information. */
  mySourceHistamine: string
  mySourceFodmap: string
}
export type OverridableField = keyof FoodFieldValues

/** Champs dont la modification fait passer la fiabilité de l'information à « vérifiée par moi ». */
export const HISTAMINE_BLOCK: readonly OverridableField[] =
  ['histamineLevel', 'histamineDetail', 'liberator', 'dao', 'otherAmines']
export const FODMAP_BLOCK: readonly OverridableField[] =
  ['fodmapLevel', 'fodmapPortion', 'fodmapTypes']

/** Une ligne du CSV d'origine, après validation. */
export interface SeedFood {
  id: string
  category: string
  nameFr: string
  nameEs: string
  personalAlert: PersonalAlert
  histamineLevel: HistamineLevel
  histamineDetail: string
  liberator: Liberator
  dao: Dao
  otherAmines: string
  histamineSources: string[]
  histamineReliability: SeedReliability
  fodmapLevel: FodmapLevel
  fodmapPortion: string
  fodmapTypes: string[]
  fodmapSources: string[]
  fodmapReliability: SeedReliability
  remark: string
  /** Valeur de la colonne a_completer du CSV (recalculée côté app, voir needsCompletion). */
  toComplete: boolean
}

/** Ligne stockée dans la table « foods » (seed) : CSV + étiquettes + synonymes de recherche. */
export interface SeedFoodRecord extends SeedFood {
  flags: AllergenFlag[]
  aliases: string[]
}

/** Aliment ajouté par l'utilisatrice (table « customFoods »). */
export interface CustomFoodRecord extends FoodFieldValues {
  id: string
  category: string
  nameFr: string
  nameEs: string
  aliases: string[]
  createdAt: number
  updatedAt: number
}

/** Modification d'UN champ d'UN aliment du seed. */
export interface FoodOverride {
  /** `${foodId}|${field}` */
  key: string
  foodId: string
  field: OverridableField
  value: unknown
  /** Valeur du seed au moment de la modification (détecte un seed qui a changé depuis). */
  seedAtEdit: unknown
  updatedAt: number
}

/** Aliment tel que l'app le voit : seed + modifications, ou aliment perso. */
export interface EffectiveFood extends FoodFieldValues {
  id: string
  origin: 'seed' | 'custom'
  category: string
  nameFr: string
  nameEs: string
  aliases: string[]
  histamineSources: string[]
  fodmapSources: string[]
  histamineReliability: Reliability
  fodmapReliability: Reliability
  /** Champs que l'utilisatrice a modifiés (qui peuvent être ramenés à l'origine). */
  overridden: OverridableField[]
  /** Champs modifiés dont la valeur du seed a changé depuis (ma valeur est conservée). */
  seedChanged: OverridableField[]
  /** Date de dernière modification (ms), si l'utilisatrice a touché la fiche. */
  modifiedAt?: number
  /** Au moins une valeur « inconnu » (histamine, libérateur, FODMAP). */
  needsCompletion: boolean
}

/** Noms/ids des catégories de rapport d'import, stockés en base pour être relus. */
export interface SeedReport {
  version: number
  hash: string
  importedAt: number
  imported: number
  rejected: { line: number; id?: string; reasons: string[] }[]
  warnings: { line: number; id?: string; message: string }[]
}

/** Source documentaire : légende S1-S12 du CSV (origin = seed) ou « Ma source » de l'utilisatrice (origin = user). */
export interface SourceRecord {
  id: string
  origin: 'seed' | 'user'
  title: string
  descFr?: string
  descEs?: string
  url?: string
  /** Sources de l'utilisatrice : aliment et information concernés. */
  foodId?: string
  block?: 'histamine' | 'fodmap'
}

/** Valeurs d'un aliment créé de zéro : tout est « inconnu » (donc « à compléter »). */
export const EMPTY_FOOD_VALUES: FoodFieldValues = {
  personalAlert: '', histamineLevel: 'inconnu', histamineDetail: '', liberator: 'inconnu', dao: 'non', otherAmines: '',
  fodmapLevel: 'inconnu', fodmapPortion: '', fodmapTypes: [], remark: '', flags: [], mySourceHistamine: '', mySourceFodmap: '',
}
