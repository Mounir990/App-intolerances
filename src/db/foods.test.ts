import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { exportAllData, importAllData } from './backup'
import {
  addCustomFood, confirmBlock, deleteCustomFood, ensureSeed, loadCatalog, revertAllFields, revertField,
  setFieldValue, type CustomFoodDraft,
} from './foods'
import { DEFAULT_SEED_SOURCES, type SeedSources } from '@/data/seedMeta'
import { buildContext, searchFoods } from '@/domain/detection'
import type { EffectiveFood } from '@/domain/foods'

let n = 0
let db: AppDB
beforeEach(() => { db = new AppDB(`test-${++n}`) })

const food = async (id: string): Promise<EffectiveFood> => (await loadCatalog(db)).find((f) => f.id === id)!

/** Variante du CSV réel : modifie une cellule d'une ligne (par id), ajoute ou retire des lignes. */
function variant(patch: (lines: string[]) => string[], version: number): SeedSources {
  const lines = DEFAULT_SEED_SOURCES.csv.replace(/\r\n/g, '\n').trim().split('\n')
  return { ...DEFAULT_SEED_SOURCES, version, csv: patch(lines).join('\n') + '\n' }
}

describe('amorçage du seed', () => {
  it('charge les 190 aliments au premier lancement et enregistre un rapport', async () => {
    const report = await ensureSeed(db)
    expect(report).toMatchObject({ imported: 190, rejected: [] })
    expect(await db.foods.count()).toBe(190)
    expect(((await db.meta.get('seed'))!.value as { version: number }).version).toBe(1)
    expect(report!.warnings.map((w) => w.id).sort()).toEqual(['chorizo', 'saucisson_sec_salami', 'yaourt_nature'])
  })

  it('ne recharge rien quand la version et le contenu sont inchangés', async () => {
    await ensureSeed(db)
    expect(await ensureSeed(db)).toBeNull()
  })

  it('ignore et signale une ligne invalide sans bloquer les autres', async () => {
    const report = await ensureSeed(db, variant((l) => [...l, 'cassee,Fruits,Cassée,Rota,,bas,x,non_signale,non,,S1,approximative,bas,,,S6,approximative,,non,EXTRA'], 1))
    expect(report!.imported).toBe(190)
    expect(report!.rejected).toHaveLength(1)
    expect(await db.foods.get('cassee')).toBeUndefined()
  })

  it('applique les étiquettes allergènes et les synonymes aux aliments importés', async () => {
    await ensureSeed(db)
    expect((await db.foods.get('kiwi'))!.flags).toEqual(['latex_fruit'])
    expect((await db.foods.get('pomme'))!.flags).toEqual([])
    expect((await db.foods.get('uf_entier'))!.aliases).toContain('huevo')
  })
})

describe('mes modifications : champ par champ, réversibles', () => {
  beforeEach(async () => { await ensureSeed(db) })

  it('modifier un champ ne touche pas au seed et passe la fiabilité à « utilisateur »', async () => {
    const before = await food('tomate')
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    const after = await food('tomate')
    expect(after.histamineLevel).toBe('bas')
    expect(after.histamineReliability).toBe('utilisateur')
    expect(after.fodmapReliability).toBe(before.fodmapReliability)
    expect(after.overridden).toEqual(['histamineLevel'])
    expect((await db.foods.get('tomate'))!.histamineLevel).toBe('moyen') // seed intact
    expect(after.modifiedAt).toBeGreaterThan(0)
  })

  it('« revenir à la valeur d\'origine » restaure la valeur ET la fiabilité du seed', async () => {
    const original = await food('tomate')
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    await revertField('tomate', 'histamineLevel', db)
    expect(await food('tomate')).toEqual(original)
  })

  it('revenir à l\'origine champ par champ, ou tout d\'un coup', async () => {
    const original = await food('tomate')
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    await setFieldValue('tomate', 'fodmapPortion', '30 g', db)
    await revertField('tomate', 'histamineLevel', db)
    expect((await food('tomate')).overridden).toEqual(['fodmapPortion'])
    await revertAllFields('tomate', db)
    expect(await food('tomate')).toEqual(original)
  })

  it('« je confirme » rend l\'information vérifiée par moi sans changer ses valeurs', async () => {
    const before = await food('pomme')
    await confirmBlock(before, 'fodmap', db)
    const after = await food('pomme')
    expect(after.fodmapReliability).toBe('utilisateur')
    expect(after.fodmapLevel).toBe(before.fodmapLevel)
    expect(after.fodmapTypes).toEqual(before.fodmapTypes)
    expect(after.histamineReliability).toBe(before.histamineReliability)
  })

  it('compléter un « ? » le fait sortir des fiches à compléter', async () => {
    const todo = async () => (await loadCatalog(db)).filter((f) => f.needsCompletion).length
    const n0 = await todo()
    expect(n0).toBe(72)
    await setFieldValue('framboise', 'histamineLevel', 'bas', db)
    expect(await todo()).toBe(n0) // le libérateur est encore inconnu
    await setFieldValue('framboise', 'liberator', 'non_signale', db)
    expect(await todo()).toBe(n0 - 1)
  })

  it('l\'alerte personnelle se marque et se démarque depuis la fiche', async () => {
    const personal = async () => (await loadCatalog(db)).filter((f) => f.personalAlert).map((f) => f.id).sort()
    expect(await personal()).toEqual(['avocat', 'banane'])
    await setFieldValue('cacahuete', 'personalAlert', 'allergene_confirme', db)
    await setFieldValue('banane', 'personalAlert', '', db)
    expect(await personal()).toEqual(['avocat', 'cacahuete'])
    await revertField('banane', 'personalAlert', db)
    expect(await personal()).toEqual(['avocat', 'banane', 'cacahuete'])
  })

  it('refuse de modifier un aliment inexistant', async () => {
    await expect(setFieldValue('nexiste_pas', 'remark', 'x', db)).rejects.toThrow(/introuvable/)
  })
})

describe('mise à jour du seed : jamais d\'écrasement de mes modifications', () => {
  beforeEach(async () => { await ensureSeed(db) })

  // Seed v2 : tomate passe à « eleve » et gagne un nouveau détail ; « pomme » reçoit un nouveau détail ;
  // une nouvelle ligne est ajoutée ; « framboise » et « mure » disparaissent.
  const v2 = () => variant((lines) => lines
    .filter((l) => !l.startsWith('mure,'))
    .map((l) => (l.startsWith('tomate,') ? l.replace(',moyen,', ',eleve,') : l))
    .map((l) => (l.startsWith('pomme,') ? l.replace('Bien tolérée selon la liste nmi', 'Texte mis à jour') : l))
    .map((l) => (l.startsWith('framboise,') ? '' : l))
    .filter(Boolean)
    .concat('litchi_noir,Fruits,Litchi noir,Lichi negro,,bas,x,non_signale,non,,S1,approximative,bas,,,S6,approximative,,non'), 2)

  it('garde ma valeur quand le seed change pour un champ que j\'ai modifié, et le signale', async () => {
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    await ensureSeed(db, v2())
    const t = await food('tomate')
    expect(t.histamineLevel).toBe('bas') // ma valeur, pas « eleve »
    expect(t.histamineReliability).toBe('utilisateur')
    expect(t.seedChanged).toEqual(['histamineLevel'])
    expect((await db.foods.get('tomate'))!.histamineLevel).toBe('eleve') // le seed, lui, a bien changé
    await revertField('tomate', 'histamineLevel', db)
    expect((await food('tomate')).histamineLevel).toBe('eleve') // « origine » = nouveau seed
  })

  it('applique la nouvelle valeur du seed aux champs que je n\'ai pas modifiés', async () => {
    await setFieldValue('pomme', 'remark', 'ma note', db)
    await ensureSeed(db, v2())
    const p = await food('pomme')
    expect(p.remark).toBe('ma note')
    expect(p.histamineDetail).toBe('Texte mis à jour')
  })

  it('ajoute les nouveaux aliments, retire ceux qui disparaissent… sauf s\'ils sont utilisés', async () => {
    await setFieldValue('framboise', 'histamineLevel', 'bas', db) // je l'ai complétée : à conserver
    await db.meals.add({ id: 'm1', ts: 1, date: '2026-01-01', createdAt: 1, updatedAt: 1, type: 'snack', items: [{ kind: 'food', foodId: 'mure' }] })
    await ensureSeed(db, v2())
    expect(await db.foods.get('litchi_noir')).toBeDefined()
    expect(await db.foods.get('mure')).toBeDefined() // utilisée dans un repas → conservée
    expect((await food('framboise')).histamineLevel).toBe('bas') // modifiée par moi → conservée
    // un aliment disparu, ni modifié ni utilisé, est bien retiré
    await ensureSeed(db, variant((l) => l.filter((x) => !x.startsWith('pomme,')), 3))
    expect(await db.foods.get('pomme')).toBeUndefined()
  })

  it('mes aliments perso ne sont jamais touchés par une mise à jour', async () => {
    const id = await addCustomFood(draft({ nameFr: 'Mon gâteau', nameEs: 'Mi bizcocho' }), db)
    await ensureSeed(db, v2())
    expect((await food(id)).nameFr).toBe('Mon gâteau')
  })
})

const draft = (over: Partial<CustomFoodDraft>): CustomFoodDraft => ({
  category: 'Mes aliments', nameFr: '', nameEs: '', personalAlert: '', histamineLevel: 'inconnu', histamineDetail: '',
  liberator: 'inconnu', dao: 'non', otherAmines: '', fodmapLevel: 'inconnu', fodmapPortion: '', fodmapTypes: [],
  remark: '', flags: [], mySourceHistamine: '', mySourceFodmap: '', ...over,
})

describe('aliments personnalisés', () => {
  beforeEach(async () => { await ensureSeed(db) })

  it('ajoute un aliment FR + ES et le retrouve dans le catalogue et la recherche', async () => {
    const id = await addCustomFood(draft({ nameFr: 'Brioche maison', nameEs: 'Brioche casera', histamineLevel: 'bas', flags: ['gluten', 'egg'] }), db)
    const f = await food(id)
    expect(f).toMatchObject({ origin: 'custom', nameFr: 'Brioche maison', histamineReliability: 'utilisateur', fodmapReliability: 'inconnue', needsCompletion: true })
    const ctx = buildContext({ foods: await loadCatalog(db) })
    expect(searchFoods('brioche', ctx).map((x) => x.id)).toContain(id)
    expect(searchFoods('casera', ctx).map((x) => x.id)).toContain(id)
  })

  it('reprend le nom dans l\'autre langue si une seule est saisie', async () => {
    const f = await food(await addCustomFood(draft({ nameFr: 'Tarte maison' }), db))
    expect(f.nameEs).toBe('Tarte maison')
  })

  it('exige au moins un nom', async () => {
    await expect(addCustomFood(draft({}), db)).rejects.toThrow(/nom/i)
  })

  it('modifie directement ses propres champs', async () => {
    const id = await addCustomFood(draft({ nameFr: 'Soupe', nameEs: 'Sopa' }), db)
    await setFieldValue(id, 'histamineLevel', 'eleve', db)
    expect((await food(id)).histamineLevel).toBe('eleve')
    expect(await db.foodOverrides.count()).toBe(0)
  })

  it('supprime UNIQUEMENT mes propres ajouts : les aliments de la base sont protégés', async () => {
    const id = await addCustomFood(draft({ nameFr: 'Soupe', nameEs: 'Sopa' }), db)
    await deleteCustomFood(id, db)
    expect(await db.customFoods.get(id)).toBeUndefined()
    await expect(deleteCustomFood('tomate', db)).rejects.toThrow(/ajoutés par toi/)
    expect(await db.foods.get('tomate')).toBeDefined()
    expect(await db.foods.count()).toBe(190)
  })
})

describe('sauvegarde JSON : mes modifications et mes ajouts sont inclus', () => {
  it('aller-retour complet (modifications, aliments perso, réglages, journal)', async () => {
    await ensureSeed(db)
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    await setFieldValue('tomate', 'mySourceHistamine', 'https://exemple.org/etude', db)
    const id = await addCustomFood(draft({ nameFr: 'Soupe', nameEs: 'Sopa', histamineLevel: 'moyen' }), db)
    await db.settings.put({ key: 'app', value: { lang: 'fr', cycleLength: 30, periodLength: 4, profile: { watchedFlags: ['solanaceae'] } } })
    await db.meals.add({ id: 'm1', ts: 1, date: '2026-01-01', createdAt: 1, updatedAt: 1, type: 'lunch', items: [{ kind: 'food', foodId: 'tomate' }] })

    const expected = await loadCatalog(db)
    const backup = JSON.parse(JSON.stringify(await exportAllData(db))) // passe par du vrai JSON

    expect(backup.tables.foodOverrides).toHaveLength(2)
    expect(backup.tables.customFoods).toHaveLength(1)
    expect(backup.tables).not.toHaveProperty('foods') // le seed n'est pas exporté : il vient du CSV

    const other = new AppDB(`test-restore-${n}`)
    await ensureSeed(other)
    await importAllData(backup, other)
    expect(await loadCatalog(other)).toEqual(expected)
    expect((await other.customFoods.get(id))!.nameFr).toBe('Soupe')
    expect((await other.settings.get('app'))!.value.lang).toBe('fr')
    expect(await other.meals.count()).toBe(1)
  })

  it('rejette un fichier invalide sans toucher aux données existantes', async () => {
    await ensureSeed(db)
    await setFieldValue('tomate', 'histamineLevel', 'bas', db)
    await expect(importAllData({ app: 'autre' }, db)).rejects.toThrow(/non reconnu/)
    await expect(importAllData(null, db)).rejects.toThrow()
    expect((await food('tomate')).histamineLevel).toBe('bas')
  })
})
