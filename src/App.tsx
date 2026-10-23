import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Placeholder } from '@/features/Placeholder'
import { TodayPage } from '@/features/today/TodayPage'
import { AddPlaceholder } from '@/features/today/AddPlaceholder'
import { FoodListPage } from '@/features/foods/FoodListPage'
import { FoodSheetPage } from '@/features/foods/FoodSheetPage'
import { NewFoodPage } from '@/features/foods/NewFoodPage'
import { ScanPage } from '@/features/foods/ScanPage'
import { SettingsPage } from '@/features/settings/SettingsPage'

/**
 * HashRouter : les routes vivent après le « # », ce qui marche hors ligne,
 * depuis l'icône installée et sur n'importe quel hébergement statique.
 * La base d'aliments est sous /settings/foods pour que l'onglet Réglages reste actif.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<TodayPage />} />
          <Route path="add/:category" element={<AddPlaceholder />} />
          <Route path="calendar" element={<Placeholder titleKey="calendar.title" />} />
          <Route path="report" element={<Placeholder titleKey="report.title" />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/foods" element={<FoodListPage />} />
          <Route path="settings/foods/new" element={<NewFoodPage />} />
          <Route path="settings/foods/scan" element={<ScanPage />} />
          <Route path="settings/foods/:id" element={<FoodSheetPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
