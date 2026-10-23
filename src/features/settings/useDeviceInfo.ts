import { useCallback, useEffect, useState } from 'react'

/** Événement Chrome/Android non standard déclenché quand l'app est installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Installation PWA : bouton « Installer » si Chrome le propose, sinon indication manuelle. */
export function useInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setDeferred(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
  }, [deferred])

  return { installed, canPrompt: deferred !== null, install }
}

/**
 * Stockage persistant : sur Android, sans cette demande Chrome peut vider IndexedDB
 * quand l'appareil manque d'espace. Important pour un journal de santé.
 */
export function useStorage() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [usageBytes, setUsageBytes] = useState<number | null>(null)

  const refresh = useCallback(async () => {
    setPersisted((await navigator.storage?.persisted?.()) ?? false)
    setUsageBytes((await navigator.storage?.estimate?.())?.usage ?? null)
  }, [])

  const protect = useCallback(async () => {
    await navigator.storage?.persist?.()
    await refresh()
  }, [refresh])

  useEffect(() => { void refresh() }, [refresh])
  return { persisted, usageBytes, protect }
}
