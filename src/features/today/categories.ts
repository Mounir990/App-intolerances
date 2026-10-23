/**
 * Catégories de l'écran « Aujourd'hui ». Chacune a UNE couleur, identique dans toute l'app
 * (cartes, graphiques, rapport). Jamais la couleur seule : un émoji et un libellé l'accompagnent.
 * Les classes Tailwind sont écrites en entier pour que le compilateur les détecte.
 */
export const CATEGORY_IDS = ['meal', 'digestive', 'skinOrl', 'gyne', 'context'] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

export type Tone = 'meal' | 'digestive' | 'skin' | 'gyne' | 'context'

export interface CategoryDef {
  id: CategoryId
  emoji: string
  /** Nom des variables de couleur (--color-cat-<tone>-fill…), pour les échelles et les graphiques. */
  tone: Tone
  /** Fond de carte + texte ; fill = pastille/graphique. */
  card: string
  dot: string
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  meal: { id: 'meal', tone: 'meal', emoji: '🍽️', card: 'bg-cat-meal-tint text-cat-meal-ink', dot: 'bg-cat-meal-fill' },
  digestive: { id: 'digestive', tone: 'digestive', emoji: '🌀', card: 'bg-cat-digestive-tint text-cat-digestive-ink', dot: 'bg-cat-digestive-fill' },
  skinOrl: { id: 'skinOrl', tone: 'skin', emoji: '🤧', card: 'bg-cat-skin-tint text-cat-skin-ink', dot: 'bg-cat-skin-fill' },
  gyne: { id: 'gyne', tone: 'gyne', emoji: '🌸', card: 'bg-cat-gyne-tint text-cat-gyne-ink', dot: 'bg-cat-gyne-fill' },
  context: { id: 'context', tone: 'context', emoji: '🌙', card: 'bg-cat-context-tint text-cat-context-ink', dot: 'bg-cat-context-fill' },
}
