import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ManagerLayout, StaffLayout } from './components/Layout'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import SetPassword from './pages/SetPassword'
import Home from './pages/staff/Home'
import Scan from './pages/staff/Scan'
import ScanProject from './pages/staff/ScanProject'

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
          </Route>
          <Route path="/manager" element={<RequireAuth manager><ManagerLayout /></RequireAuth>}>
            <Route index element={null} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
