import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId, type AppDB } from './db'
import { saveEntry } from './entries'
import {
  CUSTOM_PREFIX, isCustomSymptom, resolveSymptoms,
  type ResolvedSymptom, type SymptomCategory, type SymptomRow, type SymptomScale,
} from '@/domain/symptoms'
import type { ExtraGroup } from '@/domain/types'

// ───────────────────────── Catalogue ─────────────────────────

export async function loadSymptoms(database: AppDB = db): Promise<ResolvedSymptom[]> {
  return resolveSymptoms(await database.symptoms.toArray())
}
export function useSymptomCatalog(): ResolvedSymptom[] {
  return useLiveQuery(() => loadSymptoms(), [], resolveSymptoms([]))
}

async function patchRow(id: string, patch: Partial<SymptomRow>, database: AppDB) {
  const existing = await database.symptoms.get(id)
  await database.symptoms.put({ ...existing, id, ...patch })
}

/** Masquer un symptôme (de base ou perso) : il disparaît des propositions mais l'historique le garde. */
export const setSymptomHidden = (id: string, hidden: boolean, database: AppDB = db) => patchRow(id, { hidden }, database)
/** Changer l'émoji d'un symptôme ; une valeur vide rend l'émoji d'origine. */
export const setSymptomEmoji = (id: string, emoji: string, database: AppDB = db) => patchRow(id, { emoji: emoji.trim() || undefined }, database)

export interface CustomSymptomDraft {
  name: string
  emoji?: string
  category: SymptomCategory
  sub?: ExtraGroup
  scale?: SymptomScale
}

/** Crée un symptôme perso. Un symptôme déjà créé avec le même nom et la même catégorie est réutilisé. */
export async function addCustomSymptom(draft: CustomSymptomDraft, database: AppDB = db): Promise<string> {
  const name = draft.name.trim()
  if (!name) throw new Error('Un symptôme doit avoir un nom')
  const same = (await database.symptoms.toArray()).find(
    (r) => r.custom && r.category === draft.category && r.name?.toLowerCase() === name.toLowerCase(),
  )
  if (same) {
    if (same.hidden) await database.symptoms.update(same.id, { hidden: false })
    return same.id
  }
  const id = `${CUSTOM_PREFIX}${newId().slice(0, 8)}`
  await database.symptoms.add({
    id, custom: true, name, emoji: draft.emoji?.trim() || undefined, category: draft.category,
    sub: draft.category === 'skinOrl' ? draft.sub ?? 'other' : undefined,
    scale: draft.scale ?? (draft.category === 'gyne' ? 10 : 5), createdAt: Date.now(),
  })
  return id
}

/** Supprime un symptôme créé par l'utilisatrice (jamais un symptôme de base). Les entrées passées sont conservées. */
export async function deleteCustomSymptom(id: string, database: AppDB = db): Promise<void> {
  if (!isCustomSymptom(id)) throw new Error('Seuls les symptômes que tu as créés peuvent être supprimés')
  await database.symptoms.delete(id)
}

// ───────────────────────── Enregistrement rapide ─────────────────────────

export interface QuickLog {
  intensity: number
  ts?: number
  durationMin?: number
  note?: string
}

/**
 * Enregistre un symptôme « simple » (symptôme + intensité) dans la bonne table : c'est le geste en deux taps.
 * Les détails (heure précise, durée, note) sont facultatifs et se complètent plus tard.
 */
export async function logSymptom(symptom: ResolvedSymptom, log: QuickLog, database: AppDB = db): Promise<{ table: 'digestive' | 'extra' | 'gyne'; id: string }> {
  if (symptom.special) throw new Error('Ce symptôme a son propre formulaire')
  if (!Number.isInteger(log.intensity) || log.intensity < 1 || log.intensity > symptom.scale) {
    throw new Error(`Intensité de 1 à ${symptom.scale}`)
  }
  const fields = {
    ts: log.ts ?? Date.now(), kind: symptom.id, intensity: log.intensity,
    durationMin: log.durationMin, note: log.note?.trim() || undefined,
  }
  const table = symptom.table
  const id = await saveEntry(table, table === 'extra' ? { ...fields, group: symptom.sub ?? 'other' } : fields, undefined, database)
  return { table, id }
}

// ───────────────────────── Fréquence d'usage ─────────────────────────

/** Nombre d'entrées par symptôme sur les derniers jours : sert à proposer d'abord ceux qu'elle note le plus. */
export async function symptomUsage(days = 60, database: AppDB = db): Promise<Map<string, number>> {
  const since = Date.now() - days * 86_400_000
  const usage = new Map<string, number>()
  const bump = (id: string) => usage.set(id, (usage.get(id) ?? 0) + 1)
  for (const table of ['digestive', 'extra', 'gyne'] as const) {
    for (const r of await database.table(table).where('ts').aboveOrEqual(since).toArray()) bump(String(r.kind))
  }
  for (const r of await database.pain.where('ts').aboveOrEqual(since).toArray()) bump(r.region === 'leg' ? 'legPain' : 'pelvicPain')
  for (const _ of await database.cycleStarts.where('ts').aboveOrEqual(since).toArray()) bump('periodStart')
  return usage
}
export function useSymptomUsage(): Map<string, number> {
  return useLiveQuery(() => symptomUsage(), [], new Map<string, number>())
}
