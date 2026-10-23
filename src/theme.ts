/**
 * Thème : Auto (suit le réglage du téléphone), Clair, ou Sombre doux.
 * Les couleurs vivent dans index.css ; ici on ne pose que l'attribut data-theme,
 * la barre d'état Android (meta theme-color) et une copie locale pour le prochain démarrage.
 */
export type ThemeSetting = 'auto' | 'light' | 'dark'
export const THEME_SETTINGS: ThemeSetting[] = ['auto', 'light', 'dark']

/** Thème réellement affiché pour un réglage et la préférence du système. */
export function resolveTheme(setting: ThemeSetting, systemPrefersDark: boolean): 'light' | 'dark' {
  return setting === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : setting
}

const BAR_COLOR = { light: '#faf8f3', dark: '#181c1a' } as const

export function applyTheme(setting: ThemeSetting) {
  const root = document.documentElement
  if (setting === 'auto') delete root.dataset.theme
  else root.dataset.theme = setting
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR_COLOR[resolveTheme(setting, dark)])
  try { localStorage.setItem('theme', setting) } catch { /* stockage indisponible : sans conséquence */ }
}

/** Suit le réglage du téléphone tant que le réglage est « Auto ». */
export function watchSystemTheme(getSetting: () => ThemeSetting) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getSetting() === 'auto') applyTheme('auto')
  })
}
