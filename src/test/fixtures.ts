import { DEFAULT_SEED_SOURCES, type SeedSources } from '@/data/seedMeta'
import { buildContext } from '@/domain/detection'
import { resolveSeedFood } from '@/domain/effective'
import { parseSeedCsv } from '@/domain/seedCsv'
import type { AllergenFlag, EffectiveFood, SeedFoodRecord } from '@/domain/foods'

/** Base réelle (CSV + étiquettes), résolue sans aucune modification. */
export function realSeedRecords(sources: SeedSources = DEFAULT_SEED_SOURCES): SeedFoodRecord[] {
  return parseSeedCsv(sources.csv).foods.map((f) => ({
    ...f, flags: sources.flags[f.id] ?? [], aliases: sources.aliases[f.id] ?? [],
  }))
}

export const realCatalog = (): EffectiveFood[] => realSeedRecords().map((s) => resolveSeedFood(s, []))

export function realContext(watchedFlags: AllergenFlag[] = ['solanaceae']) {
  return buildContext({
    foods: realCatalog(),
    watchedFlags,
    derivatives: DEFAULT_SEED_SOURCES.derivatives,
    excludedFromTextDetection: DEFAULT_SEED_SOURCES.excludedFromTextDetection,
  })
}

/** Petit CSV de test (en-tête réel + lignes fournies). */
export const HEADER =
  'id,categorie,nom_fr,nom_es,alerte_perso,histamine_niveau,histamine_detail,liberateur,dao,autres_amines,histamine_sources,histamine_fiabilite,fodmap_niveau,fodmap_portion,fodmap_types,fodmap_sources,fodmap_fiabilite,remarque,a_completer'
