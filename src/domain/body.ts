import type { BodyView } from './types'

/**
 * Carte du corps (face / dos), repère SVG 200 × 420. Les côtés sont ceux de la PERSONNE :
 * en vue de face, sa droite est à gauche de l'écran ; de dos, sa gauche est à gauche de l'écran.
 * `region` : zone pelvienne (ventre, hanches, bas du dos, fesses) ou jambe (cuisses, jambes, mollets).
 */
export interface BodyZone {
  id: string
  view: BodyView
  region: 'pelvic' | 'leg'
  x: number
  y: number
  w: number
  h: number
}

const z = (id: string, view: BodyView, region: BodyZone['region'], x: number, y: number, w: number, h: number): BodyZone =>
  ({ id, view, region, x, y, w, h })

export const BODY_ZONES: BodyZone[] = [
  // Face
  z('upperAbdomenRight', 'front', 'pelvic', 62, 96, 38, 32),
  z('upperAbdomenLeft', 'front', 'pelvic', 100, 96, 38, 32),
  z('midAbdomenRight', 'front', 'pelvic', 62, 128, 38, 32),
  z('midAbdomenLeft', 'front', 'pelvic', 100, 128, 38, 32),
  z('lowerAbdomenRight', 'front', 'pelvic', 62, 160, 26, 32),
  z('lowerAbdomenCenter', 'front', 'pelvic', 88, 160, 24, 32),
  z('lowerAbdomenLeft', 'front', 'pelvic', 112, 160, 26, 32),
  z('hipRight', 'front', 'pelvic', 42, 164, 20, 36),
  z('hipLeft', 'front', 'pelvic', 138, 164, 20, 36),
  z('thighFrontRight', 'front', 'leg', 54, 206, 44, 96),
  z('thighFrontLeft', 'front', 'leg', 102, 206, 44, 96),
  z('lowerLegFrontRight', 'front', 'leg', 58, 306, 38, 102),
  z('lowerLegFrontLeft', 'front', 'leg', 104, 306, 38, 102),
  // Dos
  z('lowerBackLeft', 'back', 'pelvic', 62, 100, 26, 50),
  z('lowerBackCenter', 'back', 'pelvic', 88, 100, 24, 50),
  z('lowerBackRight', 'back', 'pelvic', 112, 100, 26, 50),
  z('sacrum', 'back', 'pelvic', 82, 152, 36, 28),
  z('buttockLeft', 'back', 'pelvic', 56, 182, 44, 44),
  z('buttockRight', 'back', 'pelvic', 100, 182, 44, 44),
  z('thighBackLeft', 'back', 'leg', 54, 230, 44, 76),
  z('thighBackRight', 'back', 'leg', 102, 230, 44, 76),
  z('calfLeft', 'back', 'leg', 58, 310, 38, 98),
  z('calfRight', 'back', 'leg', 104, 310, 38, 98),
]

export const BODY_VIEWBOX = { w: 200, h: 420 }
export const zonesOfView = (view: BodyView) => BODY_ZONES.filter((zn) => zn.view === view)
export const zoneById = (id: string) => BODY_ZONES.find((zn) => zn.id === id)

/** Zones abdominales proposées pour localiser une douleur/crampe digestive. */
export const ABDOMEN_ZONES = [
  'upperAbdomenRight', 'upperAbdomenLeft', 'midAbdomenRight', 'midAbdomenLeft',
  'lowerAbdomenRight', 'lowerAbdomenCenter', 'lowerAbdomenLeft',
] as const

/** Échelle de Bristol : 1-2 selles dures, 3-4 normales, 5-7 molles à liquides. */
export const BRISTOL_TYPES = [1, 2, 3, 4, 5, 6, 7] as const
export const bristolGroup = (n: number): 'hard' | 'normal' | 'loose' => (n <= 2 ? 'hard' : n <= 4 ? 'normal' : 'loose')
