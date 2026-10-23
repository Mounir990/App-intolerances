import type { AppSettings } from './types'

/**
 * Réglages initiaux. Le profil correspond à l'utilisatrice visée par l'app :
 * allergies confirmées (banane, avocat) et surveillance des solanacées.
 * Tout est modifiable dans les réglages.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  lang: 'es',
  cycleLength: 28,
  periodLength: 5,
  profile: {
    allergies: [
      { id: 'allergy-banana', foodId: 'banana', label: { es: 'Plátano', fr: 'Banane' }, crossReactive: true },
      { id: 'allergy-avocado', foodId: 'avocado', label: { es: 'Aguacate', fr: 'Avocat' }, crossReactive: true },
    ],
    watchedFamilies: [
      {
        id: 'family-solanaceae',
        label: { es: 'Solanáceas', fr: 'Solanacées' },
        foodIds: ['eggplant', 'potato', 'tomato', 'bell_pepper', 'chili_pepper', 'goji'],
        foodLabels: [
          { es: 'Berenjena', fr: 'Aubergine' },
          { es: 'Patata', fr: 'Pomme de terre' },
          { es: 'Tomate', fr: 'Tomate' },
          { es: 'Pimiento', fr: 'Poivron' },
          { es: 'Guindilla / chile', fr: 'Piment' },
          { es: 'Baya de goji', fr: 'Goji' },
        ],
      },
    ],
  },
}
