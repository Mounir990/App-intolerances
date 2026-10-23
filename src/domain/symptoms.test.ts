import { describe, expect, it } from 'vitest'
import es from '@/i18n/es.json'
import fr from '@/i18n/fr.json'
import { ABDOMEN_ZONES, BODY_VIEWBOX, BODY_ZONES, BRISTOL_TYPES, bristolGroup, zonesOfView } from './body'
import { EMERGENCY_NUMBER, needsEmergencyMessage } from './emergency'
import { BUILTIN_SYMPTOMS, rankByUsage, resolveSymptoms, type SymptomRow } from './symptoms'

describe('catalogue des symptômes de base', () => {
  it('identifiants uniques', () => {
    const ids = BUILTIN_SYMPTOMS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('contient tous les symptômes demandés', () => {
    const ids = new Set(BUILTIN_SYMPTOMS.map((s) => s.id))
    for (const id of [
      'pain', 'bloating', 'distension', 'belching', 'gas', 'acidity', 'nausea', 'stool', 'immediateReaction', // digestif
      'itching', 'hives', 'flush', 'eczema', 'nasalCongestion', 'runnyNose', 'sneezing', 'itchyThroatEars', 'migraine', 'urinary', // extra
      'pelvicPain', 'legPain', 'bleeding', 'periodStart', 'painDefecation', 'painUrination', 'endoBelly', 'dyspareunia', // gynéco
      'breathingDifficulty', 'lipThroatSwelling', 'faintness', // urgence
    ]) expect(ids.has(id), id).toBe(true)
  })
  it('chaque symptôme a un nom en espagnol et en français et un émoji', () => {
    for (const s of BUILTIN_SYMPTOMS) {
      expect((es.symptoms as Record<string, string>)[s.id], `es ${s.id}`).toBeTruthy()
      expect((fr.symptoms as Record<string, string>)[s.id], `fr ${s.id}`).toBeTruthy()
      expect(s.emoji.length).toBeGreaterThan(0)
    }
  })
  it('les échelles : gynécologie sur 10, le reste sur 5', () => {
    for (const s of BUILTIN_SYMPTOMS) expect(s.scale).toBe(s.category === 'gyne' ? 10 : 5)
  })
  it('les symptômes à formulaire dédié ont une route', () => {
    const special = BUILTIN_SYMPTOMS.filter((s) => s.special).map((s) => s.id).sort()
    expect(special).toEqual(['bleeding', 'immediateReaction', 'legPain', 'pain', 'pelvicPain', 'periodStart', 'stool'])
  })
})

describe('catalogue personnalisable : émoji, masquage, symptômes perso', () => {
  const rows: SymptomRow[] = [
    { id: 'bloating', hidden: true },
    { id: 'gas', emoji: '🌪️' },
    { id: 'custom:b', custom: true, name: 'Jambes lourdes', emoji: '🦶', category: 'skinOrl', sub: 'other', createdAt: 2 },
    { id: 'custom:a', custom: true, name: 'Crampes mollet', category: 'gyne', createdAt: 1 },
    { id: 'custom:incomplet', custom: true, category: 'digestive' }, // sans nom : ignoré
  ]
  const resolved = resolveSymptoms(rows)
  const get = (id: string) => resolved.find((s) => s.id === id)!

  it('sans ligne : le catalogue de base, rien de masqué', () => {
    const base = resolveSymptoms([])
    expect(base).toHaveLength(BUILTIN_SYMPTOMS.length)
    expect(base.every((s) => !s.hidden && !s.custom)).toBe(true)
  })
  it('masquer un symptôme le garde dans le catalogue (l\'historique le référence) mais pas dans les propositions', () => {
    expect(get('bloating').hidden).toBe(true)
    expect(rankByUsage(resolved, new Map()).some((s) => s.id === 'bloating')).toBe(false)
  })
  it('un émoji personnalisé remplace celui de base ; les autres sont inchangés', () => {
    expect(get('gas').emoji).toBe('🌪️')
    expect(get('nausea').emoji).toBe(BUILTIN_SYMPTOMS.find((s) => s.id === 'nausea')!.emoji)
  })
  it('les symptômes perso rejoignent la bonne table et la bonne échelle, dans l\'ordre de création', () => {
    expect(get('custom:b')).toMatchObject({ table: 'extra', sub: 'other', scale: 5, emoji: '🦶', custom: true })
    expect(get('custom:a')).toMatchObject({ table: 'gyne', scale: 10, emoji: '✨' })
    const customIds = resolved.filter((s) => s.custom).map((s) => s.id)
    expect(customIds).toEqual(['custom:a', 'custom:b'])
    expect(resolved.some((s) => s.id === 'custom:incomplet')).toBe(false)
  })
  it('« rankByUsage » met les plus utilisés en premier, sans masqués, ordre du catalogue à égalité', () => {
    const r = rankByUsage(resolved, new Map([['nausea', 5], ['gas', 5], ['hives', 9]])).map((s) => s.id)
    expect(r.slice(0, 3)).toEqual(['hives', 'gas', 'nausea']) // gas avant nausea : ordre du catalogue
    expect(r.length).toBe(resolved.length - 1)
  })
})

describe('message d\'urgence', () => {
  it.each(['breathingDifficulty', 'lipThroatSwelling', 'faintness'])('%s : toujours, quelle que soit l\'intensité', (id) => {
    expect(needsEmergencyMessage(id, 1)).toBe(true)
    expect(needsEmergencyMessage(id)).toBe(true)
  })
  it.each(['pelvicPain', 'legPain', 'painDefecation', 'painUrination', 'dyspareunia'])('%s : à partir de 9/10', (id) => {
    expect(needsEmergencyMessage(id, 8)).toBe(false)
    expect(needsEmergencyMessage(id, 9)).toBe(true)
    expect(needsEmergencyMessage(id, 10)).toBe(true)
  })
  it('douleur digestive notée sur 5 : au maximum seulement', () => {
    expect(needsEmergencyMessage('pain', 4)).toBe(false)
    expect(needsEmergencyMessage('pain', 5)).toBe(true)
  })
  it('un symptôme banal ou perso, même à l\'intensité maximale, ne déclenche rien', () => {
    expect(needsEmergencyMessage('bloating', 5)).toBe(false)
    expect(needsEmergencyMessage('migraine', 5)).toBe(false)
    expect(needsEmergencyMessage('endoBelly', 10)).toBe(false)
    expect(needsEmergencyMessage('custom:abc', 10)).toBe(false)
    expect(needsEmergencyMessage('pelvicPain')).toBe(false) // pas d'intensité : pas de déclenchement
  })
  it('le numéro d\'urgence est le 112', () => expect(EMERGENCY_NUMBER).toBe('112'))
})

describe('carte du corps', () => {
  it('identifiants de zones uniques, toutes dans le repère SVG', () => {
    expect(new Set(BODY_ZONES.map((zn) => zn.id)).size).toBe(BODY_ZONES.length)
    for (const zn of BODY_ZONES) {
      expect(zn.x).toBeGreaterThanOrEqual(0)
      expect(zn.y).toBeGreaterThanOrEqual(0)
      expect(zn.x + zn.w).toBeLessThanOrEqual(BODY_VIEWBOX.w)
      expect(zn.y + zn.h).toBeLessThanOrEqual(BODY_VIEWBOX.h)
    }
  })
  it('la face et le dos couvrent le ventre/bassin ET la jambe', () => {
    for (const view of ['front', 'back'] as const) {
      const regions = new Set(zonesOfView(view).map((zn) => zn.region))
      expect(regions).toEqual(new Set(['pelvic', 'leg']))
    }
  })
  it('aucune zone d\'une même vue ne se chevauche', () => {
    for (const view of ['front', 'back'] as const) {
      const zs = zonesOfView(view)
      for (const a of zs) for (const b of zs) {
        if (a === b) continue
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
        expect(overlap, `${a.id} / ${b.id}`).toBe(false)
      }
    }
  })
  it('chaque zone a un nom en espagnol et en français', () => {
    for (const zn of BODY_ZONES) {
      expect((es.bodyZone as Record<string, string>)[zn.id], `es ${zn.id}`).toBeTruthy()
      expect((fr.bodyZone as Record<string, string>)[zn.id], `fr ${zn.id}`).toBeTruthy()
    }
  })
  it('les zones abdominales de localisation existent sur la carte (face)', () => {
    const front = new Set(zonesOfView('front').map((zn) => zn.id))
    for (const id of ABDOMEN_ZONES) expect(front.has(id)).toBe(true)
  })
})

describe('échelle de Bristol', () => {
  it('7 types : 1-2 durs, 3-4 normaux, 5-7 mous à liquides', () => {
    expect(BRISTOL_TYPES).toHaveLength(7)
    expect(BRISTOL_TYPES.map(bristolGroup)).toEqual(['hard', 'hard', 'normal', 'normal', 'loose', 'loose', 'loose'])
  })
})
