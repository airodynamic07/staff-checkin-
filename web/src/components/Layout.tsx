import { NavLink, Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../lib/auth'
import { DemoBanner } from './DemoBanner'
import { LanguageSwitch } from './LanguageSwitch'

export function StaffLayout() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">{t('app.name')}</span>
        <LanguageSwitch />
      </header>
      <DemoBanner />
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabbar">
        <NavLink to="/" end>{t('nav.home')}</NavLink>
        <NavLink to="/scan">{t('nav.scan')}</NavLink>
        <NavLink to="/history">{t('nav.history')}</NavLink>
        <NavLink to="/settings">{t('nav.settings')}</NavLink>
        {profile?.role === 'manager' && <NavLink to="/manager">{t('nav.managerArea')}</NavLink>}
      </nav>
    </div>
  )
}

export function ManagerLayout() {
  const { t } = useTranslation()
  const links = [
    ['/manager', 'nav.onSite'],
    ['/manager/timetable', 'nav.timetable'],
    ['/manager/summary', 'nav.projectSummary'],
    ['/manager/review', 'nav.review'],
    ['/manager/export', 'nav.export'],
    ['/manager/projects', 'nav.projects'],
    ['/manager/people', 'nav.people'],
  ] as const
  return (
    <div className="shell manager">
      <header className="topbar">
        <span className="brand">{t('app.name')} · {t('nav.managerArea')}</span>
        <LanguageSwitch />
      </header>
      <nav className="sidenav">
        {links.map(([to, key]) => (
          <NavLink key={to} to={to} end={to === '/manager'}>{t(key)}</NavLink>
        ))}
        <NavLink to="/">{t('nav.staffArea')}</NavLink>
      </nav>
      <DemoBanner />
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
