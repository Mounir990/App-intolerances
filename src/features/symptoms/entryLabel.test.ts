import { describe, expect, it } from 'vitest'
import { resolveSymptoms } from '@/domain/symptoms'
import es from '@/i18n/es.json'
import fr from '@/i18n/fr.json'
import { describeEntry, editPath, symptomName } from './entryLabel'

const catalog = resolveSymptoms([{ id: 'custom:x', custom: true, name: 'Jambes lourdes', emoji: '🦶', category: 'skinOrl', createdAt: 1 }])
const lookup = (dict: Record<string, unknown>) => (key: string, o?: Record<string, unknown>) => {
  const v = key.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], dict)
  return typeof v === 'string' ? v : (o?.defaultValue as string) ?? key
}
const tFr = lookup(fr)
const base = { id: 'a', ts: new Date(2026, 2, 5, 14, 5).getTime(), date: '2026-03-05', createdAt: 1, updatedAt: 1 }

describe('résumé d\'une entrée', () => {
  it('symptôme simple : nom, intensité sur son échelle, durée', () => {
    expect(describeEntry('digestive', { ...base, kind: 'bloating', intensity: 3, durationMin: 90 }, catalog, tFr))
      .toMatchObject({ title: 'Ballonnements', detail: '3/5 · 1 h 30', time: '14:05', emoji: '🎈' })
    expect(describeEntry('gyne', { ...base, kind: 'endoBelly', intensity: 8 }, catalog, tFr).detail).toBe('8/10')
  })
  it('selles, réaction immédiate, crampe', () => {
    expect(describeEntry('digestive', { ...base, kind: 'stool', bristol: 6, count: 2 }, catalog, tFr).detail).toBe('Bristol 6 · Nombre de selles 2')
    expect(describeEntry('digestive', { ...base, kind: 'immediateReaction', reaction: 'urgency', minutesAfterMeal: 15 }, catalog, tFr).detail).toBe('Urgence · +15 min')
    expect(describeEntry('digestive', { ...base, kind: 'pain', intensity: 4, location: 'lowerAbdomenLeft', reliefByToilet: true }, catalog, tFr).detail).toBe('4/5 · Bas-ventre, gauche · ✓ WC')
  })
  it('douleur pelvienne ou à la jambe : type, intensité sur 10, zones', () => {
    const e = describeEntry('pain', { ...base, region: 'leg', painType: 'cramping', intensity: 7, zones: [{ view: 'back', zone: 'calfLeft' }] }, catalog, tFr)
    expect(e).toMatchObject({ title: 'Douleur à la jambe', detail: '7/10 · Crampe · Mollet gauche' })
  })
  it('symptôme perso : son nom et son émoji, jamais une clé technique', () => {
    expect(describeEntry('extra', { ...base, kind: 'custom:x', group: 'other', intensity: 2 }, catalog, tFr)).toMatchObject({ title: 'Jambes lourdes', emoji: '🦶', detail: '2/5' })
  })
  it('symptôme perso supprimé : libellé neutre', () => {
    expect(symptomName('custom:disparu', catalog, tFr)).toBe('Recette supprimée')
  })
  it('contexte', () => {
    expect(describeEntry('context', { ...base, kind: 'sleep', sleepHours: 6.5, sleepQuality: 2, painWakeups: 3 }, catalog, tFr).detail).toBe('6.5 h · 2/5 · 3×')
    expect(describeEntry('context', { ...base, kind: 'stress', stress: 4 }, catalog, tFr).detail).toBe('4/5')
    expect(describeEntry('context', { ...base, kind: 'medication', medName: 'Doliprane' }, catalog, tFr).detail).toBe('Doliprane')
    expect(describeEntry('context', { ...base, kind: 'activity', activity: 'yoga', activityMinutes: 45 }, catalog, tFr).detail).toBe('Yoga · 45 min')
  })
  it('chaque entrée prend la couleur de sa catégorie', () => {
    expect(describeEntry('digestive', { ...base, kind: 'gas', intensity: 1 }, catalog, tFr).category.id).toBe('digestive')
    expect(describeEntry('extra', { ...base, kind: 'hives', intensity: 1 }, catalog, tFr).category.id).toBe('skinOrl')
    expect(describeEntry('pain', { ...base, region: 'pelvic', painType: 'dull', intensity: 1, zones: [] }, catalog, tFr).category.id).toBe('gyne')
    expect(describeEntry('cycleStarts', base, catalog, tFr).category.id).toBe('gyne')
  })
  it('le texte existe aussi en espagnol', () => {
    expect(describeEntry('digestive', { ...base, kind: 'bloating', intensity: 3 }, catalog, lookup(es)).title).toBe('Hinchazón')
  })
})

describe('route de modification', () => {
  it('formulaire dédié pour douleur, début de règles, selles, réaction, crampe, saignement, contexte', () => {
    expect(editPath('pain', { ...base, id: 'p1' })).toBe('/add/gyne/pain/p1')
    expect(editPath('cycleStarts', { ...base, id: 'c1' })).toBe('/add/gyne/period/c1')
    expect(editPath('digestive', { ...base, id: 'd1', kind: 'stool' })).toBe('/add/digestive/stool/d1')
    expect(editPath('digestive', { ...base, id: 'd2', kind: 'immediateReaction' })).toBe('/add/digestive/reaction/d2')
    expect(editPath('digestive', { ...base, id: 'd3', kind: 'pain' })).toBe('/add/digestive/pain/d3')
    expect(editPath('gyne', { ...base, id: 'g1', kind: 'bleeding' })).toBe('/add/gyne/bleeding/g1')
    expect(editPath('context', { ...base, id: 'x1', kind: 'sleep' })).toBe('/add/context/sleep/x1')
  })
  it('fiche de détails pour les symptômes simples (y compris perso)', () => {
    expect(editPath('digestive', { ...base, id: 'd4', kind: 'gas' })).toBe('/add/entry/digestive/d4')
    expect(editPath('extra', { ...base, id: 'e1', kind: 'custom:x' })).toBe('/add/entry/extra/e1')
    expect(editPath('gyne', { ...base, id: 'g2', kind: 'endoBelly' })).toBe('/add/entry/gyne/g2')
  })
})
