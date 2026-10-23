import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { getSettings } from '@/db/settings'
import { initI18n } from '@/i18n'
import './index.css'

// On lit la langue enregistrée AVANT le premier rendu, pour éviter un flash de mauvaise langue.
async function boot() {
  const { lang } = await getSettings()
  await initI18n(lang)
  document.documentElement.lang = lang
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
void boot()
