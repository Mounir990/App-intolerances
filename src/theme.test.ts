import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveTheme } from './theme'

describe('résolution du thème', () => {
  it('« auto » suit le téléphone, « clair » et « sombre » l\'ignorent', () => {
    expect(resolveTheme('auto', true)).toBe('dark')
    expect(resolveTheme('auto', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

// Le sombre doit redéfinir TOUTES les couleurs du clair, sinon une couleur claire resterait collée sur fond sombre.
describe('index.css : le mode sombre couvre toutes les couleurs', () => {
  const css = readFileSync('src/index.css', 'utf8')
  const vars = (block: string) => new Set([...block.matchAll(/(--color-[a-z0-9-]+):/g)].map((m) => m[1]))
  const light = vars(css.slice(css.indexOf('@theme {'), css.indexOf(':root[data-theme="dark"]')).replace('--font-sans', ''))
  const manual = css.slice(css.indexOf(':root[data-theme="dark"]'), css.indexOf('@media (prefers-color-scheme: dark)'))
  const auto = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'), css.indexOf('html, body'))

  it('toutes les variables claires ont leur version sombre (réglage manuel)', () => {
    const dark = vars(manual)
    expect([...light].filter((v) => !dark.has(v))).toEqual([])
  })
  it('le sombre automatique redéfinit exactement les mêmes variables que le sombre manuel', () => {
    expect([...vars(auto)].sort()).toEqual([...vars(manual)].sort())
  })
  it('le sombre redéfinit « white » : les cartes (bg-white) ne restent pas blanches', () => {
    expect(vars(manual).has('--color-white')).toBe(true)
  })
})

// Contraste WCAG des paires de couleurs de l'app (texte courant ≥ 4,5 ; graphiques ≥ 3).
describe('contraste des couleurs (WCAG)', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05) }
  const css = readFileSync('src/index.css', 'utf8')
  const block = (start: string, end: string) => css.slice(css.indexOf(start), css.indexOf(end))
  const read = (b: string, name: string) => b.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))![1]
  const themes = {
    clair: block('@theme {', ':root[data-theme="dark"]'),
    sombre: block(':root[data-theme="dark"]', '@media (prefers-color-scheme: dark)'),
  }

  for (const [nom, b] of Object.entries(themes)) {
    it(`${nom} : texte, texte doux, bouton principal, alertes ≥ 4,5`, () => {
      const c = (n: string) => read(b, n)
      expect(ratio(c('ink'), c('sand-50'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c('ink-soft'), c('sand-50'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c('ink-soft'), c('sand-100'))).toBeGreaterThanOrEqual(4.5)
      // Bouton principal : texte « white » sur sauge (en sombre, « white » est redéfini en couleur de surface).
      const buttonText = nom === 'clair' ? '#ffffff' : c('white')
      expect(ratio(buttonText, c('sage-500'))).toBeGreaterThanOrEqual(4.5)
      expect(ratio(c('sage-700'), c('sage-100'))).toBeGreaterThanOrEqual(4.5)
      for (const [fg, bg] of [['alert', 'alert-bg'], ['high', 'high-bg'], ['warn', 'warn-bg'], ['user', 'user-bg']]) {
        expect(ratio(c(fg), c(bg)), `${fg}/${bg}`).toBeGreaterThanOrEqual(4.5)
      }
    })
    it(`${nom} : chaque catégorie lisible (texte ≥ 4,5 sur sa teinte, pastille ≥ 3 sur la surface)`, () => {
      for (const cat of ['meal', 'digestive', 'skin', 'gyne', 'context']) {
        expect(ratio(read(b, `cat-${cat}-ink`), read(b, `cat-${cat}-tint`)), `${cat} texte`).toBeGreaterThanOrEqual(4.5)
        expect(ratio(read(b, `cat-${cat}-fill`), read(b, nom === 'clair' ? 'sand-50' : 'white')), `${cat} pastille`).toBeGreaterThanOrEqual(3)
      }
    })
  }
})
