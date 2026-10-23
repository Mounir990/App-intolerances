import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
)

const TABS = [
  { to: '/', key: 'today', end: true, icon: icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3 2" /></>) },
  { to: '/calendar', key: 'calendar', icon: icon(<><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M8 3v4M16 3v4M4 10h16" /></>) },
  { to: '/report', key: 'report', icon: icon(<><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></>) },
  { to: '/settings', key: 'settings', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /></>) },
] as const

/** Coque de l'app : contenu défilant + barre de navigation en bas (atteignable au pouce). */
export function AppShell() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      <main className="flex-1 overflow-y-auto pb-6">
        <Outlet />
      </main>
      <nav aria-label="Principal"
        className="grid grid-cols-4 border-t border-sand-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={'end' in tab}
            className={({ isActive }) =>
              `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs ${isActive ? 'text-sage-600 font-semibold' : 'text-ink-soft'}`}>
            {tab.icon}
            {t(`nav.${tab.key}`)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
