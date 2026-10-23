/**
 * Normalisation et recherche de mots-clés insensibles à la casse et aux accents
 * (FR + ES). « Œuf » → « oeuf », « Plátano » → « platano », « d'ail » → « d ail ».
 */

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Regex d'un mot-clé déjà normalisé : bornes de mots strictes (« lait » ne matche pas
 * « laitue ») et pluriel facultatif sur chaque mot (« pommes de terre », « huevos »).
 */
export function keywordRegex(keywordNormalized: string): RegExp {
  const body = keywordNormalized
    .split(' ')
    .filter(Boolean)
    .map((w) => `${escapeRe(w)}(?:s|es|x)?`)
    .join(' ')
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'g')
}

export interface Span { start: number; end: number; text: string }

/** Toutes les occurrences d'une regex (voir keywordRegex) dans un texte normalisé. */
export function findSpans(textNormalized: string, re: RegExp): Span[] {
  const out: Span[] = []
  re.lastIndex = 0
  for (let m = re.exec(textNormalized); m; m = re.exec(textNormalized)) {
    out.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

/** Retire les spans strictement contenus dans un span plus long d'une AUTRE clé (« noix » dans « noix de cajou »). */
export function dropContained<T extends Span & { key: string }>(hits: T[]): T[] {
  return hits.filter((a) =>
    !hits.some((b) => b !== a && b.key !== a.key && b.start <= a.start && a.end <= b.end && b.end - b.start > a.end - a.start),
  )
}
