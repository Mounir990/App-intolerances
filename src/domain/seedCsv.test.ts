import { describe, expect, it } from 'vitest'
import { DEFAULT_SEED_SOURCES } from '@/data/seedMeta'
import { parseCsv, toCsv } from './csv'
import { exportEffectiveCsv, parseSeedCsv } from './seedCsv'
import { realCatalog, HEADER } from '@/test/fixtures'

const ROW = 'pomme,Fruits,Pomme,Manzana,,bas,Bien tolérée,non_signale,non,,S3,approximative,eleve,,"fructose, sorbitol","S7,S8",confirmee,,non'

describe('parseCsv', () => {
  it('gère guillemets, virgules, guillemets doublés, retours à la ligne, CRLF et BOM', () => {
    const rows = parseCsv('﻿a,"b,c","d ""e""",f\r\n"x\ny",z\r\n')
    expect(rows.map((r) => r.cells)).toEqual([['a', 'b,c', 'd "e"', 'f'], ['x\ny', 'z']])
    expect(rows[1].line).toBe(2)
  })
  it('toCsv → parseCsv est un aller-retour fidèle', () => {
    const data = [['a', 'b,c'], ['d "q"', 'e\nf']]
    expect(parseCsv(toCsv(data)).map((r) => r.cells)).toEqual(data)
  })
})

describe('parseSeedCsv — lignes valides', () => {
  it('importe une ligne valide avec tous ses champs', () => {
    const r = parseSeedCsv(`${HEADER}\n${ROW}\n`)
    expect(r.rejected).toEqual([])
    expect(r.foods).toHaveLength(1)
    expect(r.foods[0]).toMatchObject({
      id: 'pomme', nameFr: 'Pomme', nameEs: 'Manzana', histamineLevel: 'bas', liberator: 'non_signale',
      fodmapLevel: 'eleve', fodmapTypes: ['fructose', 'sorbitol'], fodmapSources: ['S7', 'S8'], histamineReliability: 'approximative',
    })
  })
})

describe('parseSeedCsv — lignes invalides', () => {
  const bad = (row: string) => parseSeedCsv(`${HEADER}\n${row}\n${ROW}\n`)

  it('ignore une ligne avec un mauvais nombre de colonnes, garde les autres', () => {
    const r = bad('x,Fruits,X,X')
    expect(r.foods.map((f) => f.id)).toEqual(['pomme'])
    expect(r.rejected[0]).toMatchObject({ line: 2, id: 'x' })
    expect(r.rejected[0].reasons[0]).toMatch(/4 colonnes/)
  })
  it.each([
    ['niveau d\'histamine', ROW.replace(',bas,Bien', ',tres_bas,Bien'), /histamine_niveau invalide/],
    ['libérateur', ROW.replace('non_signale', 'peut_etre'), /liberateur invalide/],
    ['DAO', ROW.replace(',non,,S3', ',beaucoup,,S3'), /dao invalide/],
    ['fiabilité', ROW.replace('approximative', 'sure'), /fiabilite invalide/],
    ['niveau FODMAP', ROW.replace(',eleve,,', ',moyen,,'), /fodmap_niveau invalide/],
    ['alerte perso', ROW.replace('Manzana,,bas', 'Manzana,oui,bas'), /alerte_perso invalide/],
    ['id', ROW.replace('pomme,', 'Pomme Rouge,'), /id invalide/],
  ])('rejette une valeur interdite : %s', (_n, row, msg) => {
    const r = bad(row)
    expect(r.rejected).toHaveLength(1)
    expect(r.rejected[0].reasons.join(' ')).toMatch(msg)
    expect(r.foods.map((f) => f.id)).toEqual(['pomme'])
  })
  it('ignore les doublons d\'id (la première ligne gagne) et le signale', () => {
    const r = parseSeedCsv(`${HEADER}\n${ROW}\n${ROW}\n`)
    expect(r.foods).toHaveLength(1)
    expect(r.rejected).toEqual([{ line: 3, id: 'pomme', reasons: ['id en double (déjà ligne 2)'] }])
  })
  it('refuse un fichier dont l\'en-tête est faux (rien n\'est importé)', () => {
    const r = parseSeedCsv('id,nom\npomme,Pomme\n')
    expect(r.fatal).toMatch(/En-tête/)
    expect(r.foods).toEqual([])
  })
})

describe('parseSeedCsv — avertissements de cohérence (ligne importée)', () => {
  it('signale a_completer incohérent et fiabilité contradictoire', () => {
    const row = 'yaourt,Produits laitiers,Yaourt,Yogur,,bas,x,inconnu,non,,S1,approximative,eleve,,lactose,S7,confirmee,,non'
    const r = parseSeedCsv(`${HEADER}\n${row}\n`)
    expect(r.foods).toHaveLength(1)
    expect(r.warnings.map((w) => w.message).join('|')).toMatch(/a_completer=non/)
  })
})

describe('CSV réel fourni', () => {
  const r = parseSeedCsv(DEFAULT_SEED_SOURCES.csv)
  it('importe les 190 aliments, sans ligne rejetée', () => {
    expect(r.fatal).toBeUndefined()
    expect(r.foods).toHaveLength(190)
    expect(r.rejected).toEqual([])
  })
  it('banane et avocat sont les alertes personnelles', () => {
    expect(r.foods.filter((f) => f.personalAlert).map((f) => f.id)).toEqual(['banane', 'avocat'])
  })
})

describe('export CSV de la base effective', () => {
  it('garde les 19 colonnes d\'origine et se relit sans perte', () => {
    const csv = exportEffectiveCsv(realCatalog())
    const header = parseCsv(csv)[0].cells
    expect(header.slice(0, 19).join(',')).toBe(HEADER)
    expect(header.slice(19)).toEqual(['ma_source_histamine', 'ma_source_fodmap', 'etiquettes_allergenes', 'modifie_le'])
    const rows = parseCsv(csv).slice(1)
    expect(rows).toHaveLength(190)
    expect(rows.every((x) => x.cells.length === 23)).toBe(true)
    const banane = rows.find((x) => x.cells[0] === 'banane')!.cells
    expect(banane[4]).toBe('allergene_confirme')
    expect(banane[22]).toBe('') // jamais modifiée
  })
})
