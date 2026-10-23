import { describe, expect, it } from 'vitest'
import { fodmapRank, histamineRank, isLiberator, maxKnown, resolveCustomFood, resolveSeedFood, seedFieldValue } from './effective'
import type { FoodOverride, SeedFoodRecord } from './foods'
import { realSeedRecords } from '@/test/fixtures'

const seed = (id: string): SeedFoodRecord => realSeedRecords().find((s) => s.id === id)!
const override = (foodId: string, field: FoodOverride['field'], value: unknown, seedAtEdit: unknown): FoodOverride =>
  ({ key: `${foodId}|${field}`, foodId, field, value, seedAtEdit, updatedAt: 1000 })

describe('valeur effective : seed vs modification', () => {
  it('sans modification : valeurs du seed, fiabilité du seed', () => {
    const f = resolveSeedFood(seed('tomate'), [])
    expect(f.histamineLevel).toBe('moyen')
    expect(f.histamineReliability).toBe('approximative')
    expect(f.overridden).toEqual([])
    expect(f.modifiedAt).toBeUndefined()
  })

  it('ma modification l\'emporte sur le seed, champ par champ', () => {
    const t = seed('tomate')
    const f = resolveSeedFood(t, [override('tomate', 'histamineLevel', 'bas', t.histamineLevel)])
    expect(f.histamineLevel).toBe('bas')
    expect(f.histamineDetail).toBe(t.histamineDetail) // champ non modifié : seed
    expect(f.fodmapLevel).toBe(t.fodmapLevel)
    expect(f.overridden).toEqual(['histamineLevel'])
    expect(f.modifiedAt).toBe(1000)
  })

  it('la fiabilité devient « utilisateur » pour l\'information modifiée SEULEMENT', () => {
    const t = seed('tomate')
    const f = resolveSeedFood(t, [override('tomate', 'histamineLevel', 'bas', t.histamineLevel)])
    expect(f.histamineReliability).toBe('utilisateur')
    expect(f.fodmapReliability).toBe(t.fodmapReliability) // FODMAP intact
    const g = resolveSeedFood(t, [override('tomate', 'fodmapPortion', '50 g', t.fodmapPortion)])
    expect(g.fodmapReliability).toBe('utilisateur')
    expect(g.histamineReliability).toBe(t.histamineReliability)
  })

  it('une remarque ou une « ma source » ne change pas la fiabilité', () => {
    const t = seed('tomate')
    const f = resolveSeedFood(t, [override('tomate', 'remark', 'note', t.remark), override('tomate', 'mySourceHistamine', 'lien', '')])
    expect(f.histamineReliability).toBe(t.histamineReliability)
    expect(f.fodmapReliability).toBe(t.fodmapReliability)
  })

  it('revenir à la valeur d\'origine : sans override, tout redevient comme le seed', () => {
    const t = seed('tomate')
    const modified = resolveSeedFood(t, [override('tomate', 'histamineLevel', 'bas', t.histamineLevel)])
    const reverted = resolveSeedFood(t, [])
    expect(modified.histamineLevel).not.toBe(reverted.histamineLevel)
    expect(reverted.histamineLevel).toBe(t.histamineLevel)
    expect(reverted.histamineReliability).toBe(t.histamineReliability)
    expect(seedFieldValue(t, 'histamineLevel')).toBe(t.histamineLevel)
  })

  it('si le seed change pour un champ que j\'ai modifié : ma valeur est gardée et le changement est signalé', () => {
    const t = seed('tomate')
    const mine = override('tomate', 'histamineLevel', 'bas', 'bas') // à l'époque, le seed disait « bas »
    const f = resolveSeedFood(t, [mine]) // le seed dit maintenant « moyen »
    expect(f.histamineLevel).toBe('bas')
    expect(f.seedChanged).toEqual(['histamineLevel'])
  })

  it('une valeur mise à « inconnu » par l\'utilisatrice reste inconnue (fiabilité inconnue)', () => {
    const t = seed('tomate')
    const f = resolveSeedFood(t, [override('tomate', 'histamineLevel', 'inconnu', t.histamineLevel)])
    expect(f.histamineLevel).toBe('inconnu')
    expect(f.histamineReliability).toBe('inconnue')
    expect(f.needsCompletion).toBe(true)
  })

  it('un aliment perso : valeurs connues = « vérifiées par moi », inconnues = inconnue', () => {
    const f = resolveCustomFood({
      id: 'custom_1', category: 'Mes aliments', nameFr: 'Gâteau', nameEs: 'Bizcocho', aliases: [], createdAt: 1, updatedAt: 2,
      personalAlert: '', histamineLevel: 'bas', histamineDetail: '', liberator: 'inconnu', dao: 'non', otherAmines: '',
      fodmapLevel: 'inconnu', fodmapPortion: '', fodmapTypes: [], remark: '', flags: [], mySourceHistamine: '', mySourceFodmap: '',
    })
    expect(f.origin).toBe('custom')
    expect(f.histamineReliability).toBe('utilisateur')
    expect(f.fodmapReliability).toBe('inconnue')
    expect(f.needsCompletion).toBe(true)
  })
})

describe('« inconnu » n\'est jamais « bas » ni « non »', () => {
  it('les rangs inconnus sont null, pas 0', () => {
    expect(histamineRank('inconnu')).toBeNull()
    expect(fodmapRank('inconnu')).toBeNull()
    expect(histamineRank('bas')).toBe(0)
    expect(histamineRank('inconnu')).not.toBe(histamineRank('bas'))
  })
  it('libérateur inconnu → null (ni vrai ni faux)', () => {
    expect(isLiberator('inconnu')).toBeNull()
    expect(isLiberator('non_signale')).toBe(false)
    expect(isLiberator('signale')).toBe(true)
  })
  it('un maximum calculé uniquement sur des inconnus ne vaut pas « bas »', () => {
    expect(maxKnown(['inconnu', 'inconnu'], histamineRank)).toEqual({ level: null, hasUnknown: true })
    expect(maxKnown(['bas', 'inconnu'], histamineRank)).toEqual({ level: 'bas', hasUnknown: true })
    expect(maxKnown(['bas', 'eleve', 'inconnu'], histamineRank).level).toBe('eleve')
  })
  it('dans le CSV réel, une histamine inconnue reste inconnue après résolution', () => {
    const f = resolveSeedFood(seed('framboise'), [])
    expect(f.histamineLevel).toBe('inconnu')
    expect(f.liberator).toBe('inconnu')
    expect(f.histamineReliability).toBe('inconnue')
    expect(f.needsCompletion).toBe(true)
  })
})
