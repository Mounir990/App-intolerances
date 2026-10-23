import { describe, expect, it } from 'vitest'
import es from '@/i18n/es.json'
import fr from '@/i18n/fr.json'
import { CATEGORIES, CATEGORY_IDS } from './categories'

describe('catégories de l\'écran « Aujourd\'hui »', () => {
  it('sont les cinq catégories demandées, sans doublon', () => {
    expect([...CATEGORY_IDS]).toEqual(['meal', 'digestive', 'skinOrl', 'gyne', 'context'])
    expect(new Set(CATEGORY_IDS).size).toBe(5)
  })
  it('ont un libellé en espagnol et en français', () => {
    for (const id of CATEGORY_IDS) {
      expect((es.categories as Record<string, string>)[id]).toBeTruthy()
      expect((fr.categories as Record<string, string>)[id]).toBeTruthy()
    }
  })
  it('ont chacune leur couleur, leur émoji et jamais la même couleur qu\'une autre', () => {
    const cards = CATEGORY_IDS.map((id) => CATEGORIES[id].card)
    expect(new Set(cards).size).toBe(5)
    expect(CATEGORY_IDS.every((id) => CATEGORIES[id].emoji.length > 0)).toBe(true)
  })
})
