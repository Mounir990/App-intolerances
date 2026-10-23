import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS } from '@/domain/defaults'
import type { AppSettings } from '@/domain/types'

const KEY = 'app'

/** Lit les réglages ; fusionne avec les valeurs par défaut (nouveaux champs après mise à jour). */
export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.get(KEY)
  const base = structuredClone(DEFAULT_SETTINGS)
  const stored = row?.value
  // Fusion défensive : un profil enregistré par une version plus ancienne n'a pas tous les champs.
  return {
    ...base,
    ...stored,
    profile: { ...base.profile, ...stored?.profile, watchedFlags: stored?.profile?.watchedFlags ?? base.profile.watchedFlags },
  }
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings()
  await db.settings.put({ key: KEY, value: { ...current, ...patch } })
}

/** Hook réactif : `undefined` tant que la base n'a pas répondu. */
export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), [])
}
