import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED_SOURCES } from '@/data/seedMeta'
import { analyzeMeal, buildContext, scanText, searchFoods, type FoodAlert } from './detection'
import type { AllergenFlag, EffectiveFood } from './foods'
import { realCatalog, realContext } from '@/test/fixtures'

const ctx = realContext()
const personalAlerts = (text: string): FoodAlert[] => scanText(text, ctx).alerts.filter((a) => a.kind === 'personal')
const ids = (alerts: FoodAlert[]) => alerts.map((a) => a.foodId).sort()
const declared = (text: string) => scanText(text, ctx).declared.map((d) => d.key).sort()

describe('alertes banane / avocat — texte saisi ou étiquette (FR + ES + dérivés)', () => {
  it.each([
    ['banane', 'banane'], ['Bananes mûres', 'banane'], ['purée de banane', 'banane'],
    ['plátano', 'banane'], ['PLATANO', 'banane'], ['batido de plátano', 'banane'], ['banana', 'banane'],
    ['gâteau banoffee', 'banane'], ['chips de plantain', 'banane'],
    ['avocat', 'avocat'], ['Avocats', 'avocat'], ['guacamole', 'avocat'], ['tartine d\'avocat', 'avocat'],
    ['aguacate', 'avocat'], ['Ensalada de AGUACATE', 'avocat'], ['palta', 'avocat'], ['avocado', 'avocat'],
  ])('« %s » déclenche une alerte personnelle sur %s', (text, foodId) => {
    const alerts = personalAlerts(text)
    expect(ids(alerts)).toEqual([foodId])
    expect(alerts[0].via).toBe('text')
  })

  it('détecte les deux allergènes dans un même texte', () => {
    expect(ids(personalAlerts('Salade : avocat, banane, tomate'))).toEqual(['avocat', 'banane'])
  })

  it.each(['laitue et carotte', 'pomme, poire', 'manzana', 'sandía', 'bananaramas'])('« %s » ne déclenche pas de fausse alerte', (t) => {
    expect(personalAlerts(t)).toEqual([])
  })

  it('marque « traces » quand l\'étiquette dit « peut contenir »', () => {
    const [a] = personalAlerts('Ingrédients : farine. Peut contenir des traces de banane.')
    expect(a.foodId).toBe('banane')
    expect(a.trace).toBe(true)
  })

  it('un aliment banane/avocat ajouté comme aliment (id) déclenche aussi l\'alerte', () => {
    const r = analyzeMeal([{ kind: 'food', foodId: 'banane' }], ctx)
    expect(r.alerts[0]).toMatchObject({ kind: 'personal', foodId: 'banane', via: 'food' })
  })

  it('un texte libre dans un repas déclenche l\'alerte (sécurité d\'abord) tout en restant « non analysé »', () => {
    const r = analyzeMeal([{ kind: 'free', text: 'gâteau à la banane' }], ctx)
    expect(r.alerts.map((a) => a.kind)).toEqual(['personal'])
    expect(r.unanalyzed).toEqual(['gâteau à la banane'])
  })

  it('l\'utilisatrice peut marquer un autre aliment comme allergène personnel', () => {
    const foods = realCatalog().map((f) => (f.id === 'cacahuete' ? { ...f, personalAlert: 'allergene_confirme' as const } : f))
    const c = buildContext({ foods, derivatives: DEFAULT_SEED_SOURCES.derivatives })
    expect(scanText('sauce aux cacahuètes', c).alerts).toMatchObject([{ kind: 'personal', foodId: 'cacahuete' }])
    expect(searchFoods('cacah', c)).toEqual([]) // et il disparaît des suggestions
  })

  it('si elle démarque banane et avocat, plus d\'alerte', () => {
    const foods = realCatalog().map((f) => ({ ...f, personalAlert: '' as const }))
    const c = buildContext({ foods, derivatives: DEFAULT_SEED_SOURCES.derivatives })
    expect(scanText('banane et avocat', c).alerts.filter((a) => a.kind === 'personal')).toEqual([])
    expect(searchFoods('banane', c).map((f) => f.id)).toEqual(['banane'])
  })
})

describe('banane / avocat absents de l\'autocomplétion', () => {
  const found = (q: string) => searchFoods(q, ctx, 50).map((f) => f.id)
  it.each(['banane', 'bana', 'platano', 'plátano', 'avocat', 'avoc', 'aguacate', 'agua'])('« %s » ne propose pas banane/avocat', (q) => {
    expect(found(q)).not.toContain('banane')
    expect(found(q)).not.toContain('avocat')
  })
  it('les autres aliments sont bien proposés, FR et ES, sans accent', () => {
    expect(found('pom')).toContain('pomme')
    expect(found('manzana')).toContain('pomme')
    expect(found('pomme de terre')[0]).toBe('pomme_de_terre')
    expect(found('patata')).toContain('pomme_de_terre')
    expect(found('espinaca')).toContain('epinard')
    expect(found('ÉPINARD')).toContain('epinard')
  })
  it('classe les préfixes avant les correspondances au milieu', () => {
    expect(found('lait')[0].startsWith('lait')).toBe(true)
  })
})

describe('réactivité croisée latex-fruits et familles surveillées', () => {
  const kinds = (foodIds: string[]) => analyzeMeal(foodIds.map((foodId) => ({ kind: 'food' as const, foodId })), ctx).alerts
  it.each(['kiwi', 'chataigne', 'papaye', 'mangue', 'fruit_de_la_passion'])('%s déclenche une alerte de réactivité croisée', (id) => {
    expect(kinds([id])).toMatchObject([{ kind: 'cross_latex', foodId: id }])
  })
  it('les solanacées sont signalées comme surveillées (sans alarme)', () => {
    for (const id of ['tomate', 'pomme_de_terre', 'aubergine', 'poivron_rouge', 'piment', 'baie_de_goji']) {
      expect(kinds([id])).toMatchObject([{ kind: 'watched', flag: 'solanaceae', foodId: id }])
    }
  })
  it('le chorizo (pimentón) est repéré comme solanacée', () => {
    expect(kinds(['chorizo'])[0]).toMatchObject({ kind: 'watched', flag: 'solanaceae' })
  })
  it('un fruit à réactivité croisée dans un texte déclenche l\'alerte aussi', () => {
    expect(scanText('Salade de mangue et kiwi', ctx).alerts.map((a) => `${a.kind}:${a.foodId}`).sort())
      .toEqual(['cross_latex:kiwi', 'cross_latex:mangue'])
  })
  it('classe l\'allergène confirmé avant la réactivité croisée avant la surveillance', () => {
    const r = analyzeMeal([
      { kind: 'food', foodId: 'tomate' }, { kind: 'food', foodId: 'kiwi' }, { kind: 'food', foodId: 'avocat' },
    ], ctx)
    expect(r.alerts.map((a) => a.kind)).toEqual(['personal', 'cross_latex', 'watched'])
  })
  it('sans allergène personnel du syndrome latex-fruits, pas d\'alerte croisée', () => {
    const foods = realCatalog().map((f) => ({ ...f, personalAlert: '' as const }))
    const c = buildContext({ foods, watchedFlags: ['solanaceae'] })
    expect(analyzeMeal([{ kind: 'food', foodId: 'kiwi' }], c).alerts).toEqual([])
  })
  it('la liste des familles surveillées est modifiable', () => {
    const c = realContext([])
    expect(analyzeMeal([{ kind: 'food', foodId: 'tomate' }], c).alerts).toEqual([])
    const g = realContext(['gluten'])
    expect(analyzeMeal([{ kind: 'food', foodId: 'pates_de_ble' }], g).alerts).toMatchObject([{ kind: 'watched', flag: 'gluten' }])
  })
})

describe('détection par étiquette (liste d\'ingrédients)', () => {
  it('allergènes déclarés en français', () => {
    expect(declared('Ingrédients : farine de blé, lait écrémé en poudre, œufs, lécithine de soja, sel.'))
      .toEqual(['dairy', 'egg', 'gluten', 'soy'])
  })
  it('allergènes déclarés en espagnol', () => {
    expect(declared('Ingredientes: harina de trigo, leche, huevo, mostaza, apio.'))
      .toEqual(['celery', 'dairy', 'egg', 'gluten', 'mustard'])
  })
  it('insensible à la casse et aux accents', () => {
    expect(declared('LAIT, ŒUF, BLÉ')).toEqual(declared('lait, oeuf, ble'))
    expect(declared('LECHE, HUEVO, TRIGO')).toEqual(['dairy', 'egg', 'gluten'])
  })
  it('« sans gluten », « sin lactosa », lait végétal et noix de coco ne sont pas des allergènes', () => {
    expect(declared('pain sans gluten')).toEqual([])
    expect(declared('pan sin gluten, bebida sin lactosa')).toEqual([])
    expect(declared('lait de soja')).toEqual(['soy'])
    expect(declared('noix de coco')).toEqual([])
    expect(declared('beurre de cacahuète')).toEqual(['peanut'])
    expect(declared('laitue')).toEqual([])
  })
  it('« lait sans lactose » contient bien du lait', () => {
    expect(declared('lait sans lactose')).toEqual(['dairy'])
  })
  it('les traces sont distinguées', () => {
    const s = scanText('Farine de blé. Peut contenir des traces de fruits à coque et de sésame.', ctx)
    const by = Object.fromEntries(s.declared.map((d) => [d.key, d.trace]))
    expect(by).toEqual({ gluten: false, tree_nuts: true, sesame: true })
  })
  it('reconnaît les aliments de la base (pluriels, FR/ES), sans doublon avec l\'aliment plus long', () => {
    const s = scanText('Tomates, pommes de terre, huile d\'olive, noix de cajou, eau', ctx)
    expect(s.foods.map((h) => h.key).sort()).toEqual(['huile_d_olive', 'noix_de_cajou', 'pomme_de_terre', 'tomate'])
    expect(scanText('patatas y cebolla', ctx).foods.map((h) => h.key).sort()).toEqual(['oignon', 'pomme_de_terre'])
  })
  it('signale les solanacées d\'une étiquette (paprika, pimentón…) comme surveillées', () => {
    const alerts = scanText('Ingrédients : porc, paprika, sel', ctx).alerts
    expect(alerts).toMatchObject([{ kind: 'watched', flag: 'solanaceae', via: 'text' }])
    expect(scanText('pimentón de la Vera', ctx).alerts[0]).toMatchObject({ kind: 'watched', flag: 'solanaceae' })
  })
})

describe('analyse d\'un repas', () => {
  const meal = (...foodIds: string[]) => analyzeMeal(foodIds.map((foodId) => ({ kind: 'food' as const, foodId })), ctx)

  it('agrège étiquettes, histamine (max connu), FODMAP et lactose', () => {
    const r = meal('pates_de_ble', 'tomate', 'lait_de_vache', 'oignon')
    expect(r.labels.flags.sort()).toEqual(['dairy', 'gluten', 'solanaceae'])
    expect(r.labels.lactose).toBe(true)
    expect(r.labels.histamine.max).toBe('moyen') // tomate
    expect(r.labels.fodmap.max).toBe('eleve')
    expect(r.labels.fodmap.types).toEqual(expect.arrayContaining(['fructanes', 'lactose']))
    expect(r.labels.histamine.liberators).toEqual(['tomate', 'lait_de_vache'])
  })

  it('un repas dont tous les aliments sont inconnus n\'est JAMAIS « bas » : niveau null + incomplet', () => {
    const r = meal('framboise', 'mure')
    expect(r.labels.histamine.max).toBeNull()
    expect(r.labels.histamine.hasUnknown).toBe(true)
    expect(r.labels.histamine.liberatorUnknown).toEqual(['framboise', 'mure'])
    expect(r.labels.histamine.liberators).toEqual([])
    expect(r.toComplete).toEqual(['framboise', 'mure'])
  })

  it('un inconnu mêlé à des valeurs connues ne les abaisse pas et reste signalé', () => {
    const r = meal('manchego_curado', 'framboise')
    expect(r.labels.histamine.max).toBe('eleve')
    expect(r.labels.histamine.hasUnknown).toBe(true)
    expect(r.toComplete).toContain('framboise')
  })

  it('la mention « à vérifier » apparaît dès qu\'une valeur approximative est en jeu', () => {
    expect(meal('tomate').needsReview).toBe(true)
    expect(meal('framboise').needsReview).toBe(true) // FODMAP approximatif
  })

  it('un plat en texte libre ou une recette sans ingrédient est « non analysé »', () => {
    const c = buildContext({ foods: realCatalog(), recipes: [{ id: 'r1', items: [] }, { id: 'r2', items: [{ foodId: 'pates_de_ble' }, { foodId: 'tomate' }] }] })
    const r = analyzeMeal([{ kind: 'free', text: 'lasagnes' }, { kind: 'recipe', recipeId: 'r1' }, { kind: 'recipe', recipeId: 'r2' }], c)
    expect(r.unanalyzed).toEqual(['lasagnes', 'r1'])
    expect(r.foods.map((f) => f.id)).toEqual(['pates_de_ble', 'tomate']) // la recette r2 est bien analysée
    expect(r.labels.flags.sort()).toEqual(['gluten', 'solanaceae'])
  })

  it('un aliment supprimé est rapporté dans « missing » sans faire planter l\'analyse', () => {
    const r = meal('custom_disparu', 'tomate')
    expect(r.missing).toEqual(['custom_disparu'])
    expect(r.foods.map((f) => f.id)).toEqual(['tomate'])
  })
})

describe('étiquettes allergènes du fichier allergen_flags.json', () => {
  it('ne référence que des aliments existants dans le CSV', () => {
    const known = new Set(realCatalog().map((f: EffectiveFood) => f.id))
    const unknown = Object.keys(DEFAULT_SEED_SOURCES.flags).filter((id) => !known.has(id))
    expect(unknown).toEqual([])
  })
  it('n\'utilise que des étiquettes valides', () => {
    const valid = new Set<AllergenFlag>(['gluten', 'dairy', 'egg', 'fish', 'crustaceans', 'molluscs', 'peanut', 'tree_nuts', 'soy', 'celery', 'mustard', 'sesame', 'solanaceae', 'latex_fruit'])
    for (const flags of Object.values(DEFAULT_SEED_SOURCES.flags)) for (const f of flags) expect(valid.has(f)).toBe(true)
  })
  it('les aliments à réactivité croisée demandés sont tous étiquetés', () => {
    const c = Object.fromEntries(realCatalog().map((f) => [f.id, f]))
    for (const id of ['banane', 'avocat', 'kiwi', 'chataigne', 'papaye', 'mangue', 'fruit_de_la_passion']) {
      expect(c[id].flags).toContain('latex_fruit')
    }
  })
})
