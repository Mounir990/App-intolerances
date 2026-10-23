import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from './es.json'
import fr from './fr.json'
import type { Lang } from '@/domain/types'

export const LANGS: Lang[] = ['es', 'fr']

/** Initialise i18next. Espagnol par défaut ; le français est une option des réglages. */
export function initI18n(lang: Lang = 'es') {
  return i18n.use(initReactI18next).init({
    resources: { es: { translation: es }, fr: { translation: fr } },
    lng: lang,
    fallbackLng: 'es',
    interpolation: { escapeValue: false }, // React échappe déjà
  })
}

/** Change la langue et met à jour l'attribut <html lang> (lecteurs d'écran, césure). */
export async function setLanguage(lang: Lang) {
  await i18n.changeLanguage(lang)
  document.documentElement.lang = lang
}

export default i18n
