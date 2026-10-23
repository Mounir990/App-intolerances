// Génère les icônes PWA (PNG) sans dépendance : rasterisation par supersampling
// d'un motif simple (une feuille sur fond sauge), puis écriture PNG via zlib.
// Usage : npm run icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [95, 138, 122] // sauge
const FG = [250, 248, 243] // blanc cassé

function crc32(buf) {
  let c, crc = ~0
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8 bits, RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ])
}

// Coordonnées normalisées [0,1]. `scale` réduit le motif (zone sûre maskable).
function sample(u, v, { rounded, scale }) {
  // fond (coins arrondis ou plein)
  let bgA = 1
  if (rounded) {
    const r = 0.22, cx = Math.min(Math.max(u, r), 1 - r), cy = Math.min(Math.max(v, r), 1 - r)
    bgA = Math.hypot(u - cx, v - cy) <= r ? 1 : 0
  }
  // feuille = intersection de deux disques, tournée à 45°
  const x = (u - 0.5) / scale, y = (v - 0.5) / scale
  const c = Math.SQRT1_2
  const a = (x + y) * c, b = (y - x) * c // axes de la feuille (a : longueur)
  const R = 0.46, d = 0.30
  const inLeaf = Math.hypot(a, b - d) <= R && Math.hypot(a, b + d) <= R
  const rib = Math.abs(b) < 0.012 && Math.abs(a) < 0.28 // nervure dans le sens de la longueur
  if (bgA === 0) return [0, 0, 0, 0]
  if (inLeaf && !rib) return [...FG, 255]
  return [...BG, 255]
}

function render(size, opts) {
  const SS = 3, buf = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let r = 0, g = 0, b = 0, a = 0
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const [pr, pg, pb, pa] = sample((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size, opts)
      r += pr * pa; g += pg * pa; b += pb * pa; a += pa
    }
    const o = (y * size + x) * 4, n = SS * SS
    buf[o] = a ? r / a : 0; buf[o + 1] = a ? g / a : 0; buf[o + 2] = a ? b / a : 0; buf[o + 3] = a / n
  }
  return png(size, buf)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/icons/icon-192.png', render(192, { rounded: true, scale: 1 }))
writeFileSync('public/icons/icon-512.png', render(512, { rounded: true, scale: 1 }))
writeFileSync('public/icons/maskable-512.png', render(512, { rounded: false, scale: 0.72 }))
writeFileSync('public/icons/apple-touch-icon.png', render(180, { rounded: false, scale: 0.85 }))
console.log('Icônes générées dans public/icons/')
