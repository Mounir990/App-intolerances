/**
 * Version de la base d'origine (CSV + étiquettes + synonymes).
 * À incrémenter quand tu remplaces/mises à jour le CSV. Au démarrage, si la version
 * (ou le contenu) a changé, la base d'origine est rechargée ; tes modifications
 * (table foodOverrides) et tes aliments perso ne sont JAMAIS touchés.
 */
export const SEED_VERSION = 1

import csvText from './base_aliments_histamine_fodmap.csv?raw'
import flagsJson from './allergen_flags.json'
import keywordsJson from './food_keywords.json'
import type { AllergenFlag } from '@/domain/foods'

export interface SeedSources {
  version: number
  csv: string
  flags: Record<string, AllergenFlag[]>
  aliases: Record<string, string[]>
  derivatives: Record<string, string[]>
  excludedFromTextDetection: string[]
}

export const DEFAULT_SEED_SOURCES: SeedSources = {
  version: SEED_VERSION,
  csv: csvText,
  flags: flagsJson.flags as Record<string, AllergenFlag[]>,
  aliases: keywordsJson.aliases,
  derivatives: keywordsJson.derivatives,
  excludedFromTextDetection: keywordsJson.excludedFromTextDetection,
}
