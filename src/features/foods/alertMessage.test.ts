import { describe, expect, it } from 'vitest'
import es from '@/i18n/es.json'
import fr from '@/i18n/fr.json'
import { scanText } from '@/domain/detection'
import { realContext } from '@/test/fixtures'
import { alertMessage } from './shared'

// Le défaut corrigé ici : l'alerte douce affichait le message « famille surveillée » au lieu du sien.
const get = (dict: Record<string, unknown>, key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict) as string

describe('message de chaque niveau d\'alerte', () => {
  const kinds = [
    { kind: 'personal', via: 'food' }, { kind: 'cross_latex', via: 'food' },
    { kind: 'cross_latex_weak', via: 'food' }, { kind: 'watched', via: 'food', flag: 'solanaceae' },
  ] as const

  it('chaque niveau a sa propre clé, toutes distinctes', () => {
    const keys = kinds.map((a) => alertMessage({ ...a, foodId: 'x' }, 'X', 'Fam').key)
    expect(new Set(keys).size).toBe(4)
  })
  it('l\'alerte douce dit « preuve plus faible » en français et « evidencia más débil » en espagnol', () => {
    const { key } = alertMessage({ kind: 'cross_latex_weak', via: 'food', foodId: 'fraise' }, 'Fraise', '')
    expect(get(fr, key)).toMatch(/preuve plus faible/)
    expect(get(es, key)).toMatch(/evidencia más débil/)
    expect(get(fr, 'detect.cross')).not.toMatch(/plus faible/) // l'alerte forte ne le dit pas
  })
  it('toutes les clés utilisées existent dans les deux langues', () => {
    const c = realContext()
    for (const text of ['guacamole', 'kiwi', 'fraise', 'paprika', 'tomate']) {
      for (const a of scanText(text, c).alerts) {
        const { key } = alertMessage(a, 'N', 'F')
        expect(get(fr, key), key).toBeTruthy()
        expect(get(es, key), key).toBeTruthy()
      }
    }
  })
})
