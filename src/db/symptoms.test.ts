import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { AppDB } from './db'
import { deleteEntry, entriesOfDay, getEntry, saveEntry, usualMedications } from './entries'
import { addCustomSymptom, deleteCustomSymptom, loadSymptoms, logSymptom, setSymptomEmoji, setSymptomHidden, symptomUsage } from './symptoms'
import { exportAllData, importAllData } from './backup'
import { countsForDay } from './today'
import { dateKey, toTs } from '@/domain/time'

let n = 0
let db: AppDB
beforeEach(() => { db = new AppDB(`sym-${++n}`) })
const sym = async (id: string) => (await loadSymptoms(db)).find((s) => s.id === id)!

describe('enregistrement rapide : symptôme + intensité', () => {
  it('un symptôme digestif va dans la table digestive, horodaté à l\'instant', async () => {
    const before = Date.now()
    const { table, id } = await logSymptom(await sym('bloating'), { intensity: 3 }, db)
    const row = (await db.digestive.get(id))!
    expect(table).toBe('digestive')
    expect(row).toMatchObject({ kind: 'bloating', intensity: 3 })
    expect(row.ts).toBeGreaterThanOrEqual(before)
    expect(row.date).toBe(dateKey(row.ts))
  })
  it('peau/ORL/autres vont dans « extra » avec leur sous-groupe', async () => {
    const hives = await logSymptom(await sym('hives'), { intensity: 2, durationMin: 30 }, db)
    const sneeze = await logSymptom(await sym('sneezing'), { intensity: 4 }, db)
    const migraine = await logSymptom(await sym('migraine'), { intensity: 5 }, db)
    expect(await db.extra.get(hives.id)).toMatchObject({ group: 'skin', kind: 'hives', durationMin: 30 })
    expect(await db.extra.get(sneeze.id)).toMatchObject({ group: 'orl', kind: 'sneezing' })
    expect(await db.extra.get(migraine.id)).toMatchObject({ group: 'other', kind: 'migraine' })
  })
  it('les symptômes gynécologiques se notent sur 10', async () => {
    const r = await logSymptom(await sym('endoBelly'), { intensity: 9 }, db)
    expect(await db.gyne.get(r.id)).toMatchObject({ kind: 'endoBelly', intensity: 9 })
    await expect(logSymptom(await sym('endoBelly'), { intensity: 11 }, db)).rejects.toThrow(/1 à 10/)
  })
  it('refuse une intensité hors échelle, et les symptômes qui ont leur propre formulaire', async () => {
    await expect(logSymptom(await sym('gas'), { intensity: 6 }, db)).rejects.toThrow(/1 à 5/)
    await expect(logSymptom(await sym('gas'), { intensity: 0 }, db)).rejects.toThrow()
    await expect(logSymptom(await sym('gas'), { intensity: 2.5 }, db)).rejects.toThrow()
    await expect(logSymptom(await sym('stool'), { intensity: 3 }, db)).rejects.toThrow(/formulaire/)
  })
  it('les détails facultatifs (heure, durée, note) se complètent après coup', async () => {
    const { id } = await logSymptom(await sym('nausea'), { intensity: 2 }, db)
    const ts = toTs('2026-03-05', '08:15')
    await saveEntry('digestive', { ts, intensity: 2, kind: 'nausea', durationMin: 60, note: 'après le café' }, id, db)
    expect(await db.digestive.get(id)).toMatchObject({ date: '2026-03-05', ts, durationMin: 60, note: 'après le café' })
    expect(await db.digestive.count()).toBe(1)
  })
})

describe('symptômes personnalisés et « autre symptôme »', () => {
  it('crée un symptôme perso, le note comme n\'importe quel autre, et le retrouve ensuite', async () => {
    const id = await addCustomSymptom({ name: 'Jambes lourdes', emoji: '🦶', category: 'skinOrl' }, db)
    expect(id.startsWith('custom:')).toBe(true)
    const s = await sym(id)
    expect(s).toMatchObject({ name: 'Jambes lourdes', emoji: '🦶', custom: true, table: 'extra', sub: 'other', scale: 5 })
    const logged = await logSymptom(s, { intensity: 3 }, db)
    expect(await db.extra.get(logged.id)).toMatchObject({ kind: id, group: 'other' })
  })
  it('un nom déjà créé (même catégorie) est réutilisé, pas dupliqué', async () => {
    const a = await addCustomSymptom({ name: 'Jambes lourdes', category: 'skinOrl' }, db)
    const b = await addCustomSymptom({ name: '  jambes LOURDES ', category: 'skinOrl' }, db)
    expect(b).toBe(a)
    expect((await loadSymptoms(db)).filter((s) => s.custom)).toHaveLength(1)
  })
  it('un symptôme perso masqué réapparaît quand on le recrée', async () => {
    const id = await addCustomSymptom({ name: 'Fourmillements', category: 'digestive' }, db)
    await setSymptomHidden(id, true, db)
    expect((await sym(id)).hidden).toBe(true)
    await addCustomSymptom({ name: 'Fourmillements', category: 'digestive' }, db)
    expect((await sym(id)).hidden).toBe(false)
  })
  it('refuse un nom vide', async () => {
    await expect(addCustomSymptom({ name: '  ', category: 'gyne' }, db)).rejects.toThrow(/nom/)
  })
  it('suppression : seulement les symptômes perso ; les entrées passées sont conservées', async () => {
    const id = await addCustomSymptom({ name: 'Test', category: 'digestive' }, db)
    const logged = await logSymptom(await sym(id), { intensity: 1 }, db)
    await deleteCustomSymptom(id, db)
    expect((await loadSymptoms(db)).some((s) => s.id === id)).toBe(false)
    expect(await db.digestive.get(logged.id)).toBeDefined()
    await expect(deleteCustomSymptom('bloating', db)).rejects.toThrow(/que tu as créés/)
  })
  it('masquer / changer l\'émoji d\'un symptôme de base, et revenir à l\'émoji d\'origine', async () => {
    const original = (await sym('gas')).emoji
    await setSymptomEmoji('gas', '🌪️', db)
    await setSymptomHidden('gas', true, db)
    expect(await sym('gas')).toMatchObject({ emoji: '🌪️', hidden: true })
    await setSymptomEmoji('gas', '', db)
    expect(await sym('gas')).toMatchObject({ emoji: original, hidden: true })
    await setSymptomHidden('gas', false, db)
    expect((await sym('gas')).hidden).toBe(false)
  })
})

describe('entrées du jour, comptage et fréquence d\'usage', () => {
  const day = '2026-03-05'
  const at = (time: string) => toTs(day, time)

  it('rassemble toutes les tables d\'un jour dans l\'ordre chronologique, sans mélanger les jours', async () => {
    await saveEntry('digestive', { ts: at('12:00'), kind: 'gas', intensity: 2 }, undefined, db)
    await saveEntry('extra', { ts: at('08:00'), group: 'skin', kind: 'hives', intensity: 1 }, undefined, db)
    await saveEntry('pain', { ts: at('10:00'), region: 'leg', painType: 'cramping', intensity: 6, zones: [{ view: 'back', zone: 'calfLeft' }] }, undefined, db)
    await saveEntry('cycleStarts', { ts: at('07:00') }, undefined, db)
    await saveEntry('context', { ts: at('09:00'), kind: 'stress', stress: 4 }, undefined, db)
    await saveEntry('gyne', { ts: toTs('2026-03-06', '09:00'), kind: 'bleeding', bleedingType: 'light' }, undefined, db)
    const list = await entriesOfDay(day, db)
    expect(list.map((e) => e.table)).toEqual(['cycleStarts', 'extra', 'context', 'pain', 'digestive'])
  })
  it('les compteurs de l\'écran Aujourd\'hui suivent : douleur et début de règles comptent en gynécologie', async () => {
    await saveEntry('pain', { ts: at('10:00'), region: 'pelvic', painType: 'dull', intensity: 4, zones: [] }, undefined, db)
    await saveEntry('cycleStarts', { ts: at('07:00') }, undefined, db)
    await saveEntry('digestive', { ts: at('12:00'), kind: 'gas', intensity: 2 }, undefined, db)
    expect(await countsForDay(day, db)).toEqual({ meal: 0, digestive: 1, skinOrl: 0, gyne: 2, context: 0 })
  })
  it('supprimer et relire une entrée', async () => {
    const id = await saveEntry('digestive', { ts: at('12:00'), kind: 'gas', intensity: 2 }, undefined, db)
    expect(await getEntry('digestive', id, db)).toMatchObject({ kind: 'gas' })
    await deleteEntry('digestive', id, db)
    expect(await getEntry('digestive', id, db)).toBeUndefined()
  })
  it('compte l\'usage récent (douleurs et début de règles inclus) pour proposer d\'abord les plus notés', async () => {
    const now = Date.now()
    for (let i = 0; i < 3; i++) await saveEntry('digestive', { ts: now - i * 1000, kind: 'bloating', intensity: 2 }, undefined, db)
    await saveEntry('pain', { ts: now, region: 'leg', painType: 'dull', intensity: 3, zones: [] }, undefined, db)
    await saveEntry('cycleStarts', { ts: now }, undefined, db)
    await saveEntry('digestive', { ts: now - 200 * 86_400_000, kind: 'gas', intensity: 1 }, undefined, db) // trop ancien
    const usage = await symptomUsage(60, db)
    expect(usage.get('bloating')).toBe(3)
    expect(usage.get('legPain')).toBe(1)
    expect(usage.get('periodStart')).toBe(1)
    expect(usage.has('gas')).toBe(false)
  })
  it('médicaments habituels : les plus fréquents d\'abord', async () => {
    for (const name of ['Doliprane', 'Magnésium', 'Doliprane', 'Doliprane', 'Magnésium', 'Vitamine D']) {
      await saveEntry('context', { ts: Date.now(), kind: 'medication', medName: name }, undefined, db)
    }
    expect(await usualMedications(db)).toEqual(['Doliprane', 'Magnésium', 'Vitamine D'])
  })
  it('la sauvegarde JSON inclut mes symptômes perso et mes réglages d\'émoji/masquage', async () => {
    const id = await addCustomSymptom({ name: 'Jambes lourdes', emoji: '🦶', category: 'skinOrl' }, db)
    await setSymptomHidden('gas', true, db)
    const backup = JSON.parse(JSON.stringify(await exportAllData(db)))
    const other = new AppDB(`sym-restore-${n}`)
    await importAllData(backup, other)
    const restored = await loadSymptoms(other)
    expect(restored.find((s) => s.id === id)).toMatchObject({ name: 'Jambes lourdes', emoji: '🦶' })
    expect(restored.find((s) => s.id === 'gas')!.hidden).toBe(true)
  })
})
