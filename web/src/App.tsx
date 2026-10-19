import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ManagerLayout, StaffLayout } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Export from './pages/manager/Export'
import OnSite from './pages/manager/OnSite'
import People from './pages/manager/People'
import ProjectQr from './pages/manager/ProjectQr'
import Projects from './pages/manager/Projects'
import ProjectSummary from './pages/manager/ProjectSummary'
import Review from './pages/manager/Review'
import Timetable from './pages/manager/Timetable'
import History from './pages/staff/History'
import Home from './pages/staff/Home'
import Scan from './pages/staff/Scan'
import ScanProject from './pages/staff/ScanProject'
import Settings from './pages/staff/Settings'

function RequireAuth({ children, manager = false }: { children: ReactNode; manager?: boolean }) {
  const { session, profile, loading } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()
  if (loading || (session && !profile)) return <p className="center muted">{t('app.loading')}</p>
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/login?next=${next}`} replace />
  }
  if (manager && profile?.role !== 'manager') return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/set-password" element={<SetPassword />} />
          <Route element={<RequireAuth><StaffLayout /></RequireAuth>}>
            <Route index element={<Home />} />
            <Route path="scan" element={<Scan />} />
            <Route path="scan/:code" element={<ScanProject />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/manager" element={<RequireAuth manager><ManagerLayout /></RequireAuth>}>
            <Route index element={<OnSite />} />
            <Route path="timetable" element={<Timetable />} />
            <Route path="summary" element={<ProjectSummary />} />
            <Route path="review" element={<Review />} />
            <Route path="export" element={<Export />} />
            <Route path="projects" element={<Projects />} />
            <Route path="projects/:id/qr" element={<ProjectQr />} />
            <Route path="people" element={<People />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
