import type { AppSettings } from './types'

/**
 * Réglages initiaux. Les allergies personnelles (banane, avocat) viennent de la colonne
 * « alerte_perso » de la base d'aliments ; ici on ne règle que les familles surveillées.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  lang: 'es',
  theme: 'auto',
  hiddenCategories: [],
  cycleLength: 28,
  periodLength: 5,
  profile: { watchedFlags: ['solanaceae'] },
}
