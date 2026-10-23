import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Placeholder } from '@/features/Placeholder'
import { SettingsPage } from '@/features/settings/SettingsPage'

/**
 * HashRouter : les routes vivent après le « # », ce qui marche hors ligne,
 * depuis l'icône installée et sur n'importe quel hébergement statique.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Placeholder titleKey="today.title" subtitleKey="today.hello" />} />
          <Route path="calendar" element={<Placeholder titleKey="calendar.title" />} />
          <Route path="report" element={<Placeholder titleKey="report.title" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
