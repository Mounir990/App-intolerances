/**
 * Catégories de l'écran « Aujourd'hui ». Chacune a UNE couleur, identique dans toute l'app
 * (cartes, graphiques, rapport). Jamais la couleur seule : un émoji et un libellé l'accompagnent.
 * Les classes Tailwind sont écrites en entier pour que le compilateur les détecte.
 */
export const CATEGORY_IDS = ['meal', 'digestive', 'skinOrl', 'gyne', 'context'] as const
export type CategoryId = (typeof CATEGORY_IDS)[number]

export interface CategoryDef {
  id: CategoryId
  emoji: string
  /** Fond de carte + texte ; fill = pastille/graphique. */
  card: string
  dot: string
}

export const CATEGORIES: Record<CategoryId, CategoryDef> = {
  meal: { id: 'meal', emoji: '🍽️', card: 'bg-cat-meal-tint text-cat-meal-ink', dot: 'bg-cat-meal-fill' },
  digestive: { id: 'digestive', emoji: '🌀', card: 'bg-cat-digestive-tint text-cat-digestive-ink', dot: 'bg-cat-digestive-fill' },
  skinOrl: { id: 'skinOrl', emoji: '🤧', card: 'bg-cat-skin-tint text-cat-skin-ink', dot: 'bg-cat-skin-fill' },
  gyne: { id: 'gyne', emoji: '🌸', card: 'bg-cat-gyne-tint text-cat-gyne-ink', dot: 'bg-cat-gyne-fill' },
  context: { id: 'context', emoji: '🌙', card: 'bg-cat-context-tint text-cat-context-ink', dot: 'bg-cat-context-fill' },
}
