import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ensureSeed } from '@/db/foods'
import { getSettings } from '@/db/settings'
import { initI18n } from '@/i18n'
import './index.css'

// Avant le premier rendu : base d'aliments chargée (1er lancement / mise à jour du seed)
// et langue enregistrée lue, pour éviter tout flash de mauvaise langue.
async function boot() {
  await ensureSeed()
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
