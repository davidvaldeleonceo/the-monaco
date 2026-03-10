import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './apiClient'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import Layout from './components/layout/Layout'
import Lavadas from './components/pages/Lavadas'
import Clientes from './components/pages/Clientes'
import Reportes from './components/pages/Reportes'
import PagoTrabajadores from './components/pages/PagoTrabajadores'
import Configuracion from './components/pages/Configuracion'
import Home from './components/pages/Home'
import LandingPage from './components/pages/LandingPage'
import { DataProvider } from './components/context/DataContext'
import { TenantProvider, useTenant } from './components/context/TenantContext'
import { ThemeProvider } from './components/context/ThemeContext'
import { MoneyVisibilityProvider } from './components/context/MoneyVisibilityContext'
import { ToastProvider } from './components/layout/Toast'
import Onboarding from './components/auth/Onboarding'
import SetupWizard from './components/auth/SetupWizard'
import RoleGuard from './components/guards/RoleGuard'
import AdminDashboard from './components/Admin/AdminDashboard'
import PlanGuard from './components/guards/PlanGuard'
import { TourProvider } from './components/layout/AppTour'
import './App.css'

function AuthenticatedApp({ session }) {
  const { loading, needsOnboarding, needsSetup } = useTenant()

  if (loading) {
    return <div className="loading-screen">Cargando...</div>
  }

  if (needsOnboarding) {
    return <Onboarding />
  }

  if (needsSetup) {
    return <SetupWizard />
  }

  return (
    <DataProvider>
      <TourProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route element={<Layout user={session.user} />}>
          <Route path="/home" element={<RoleGuard path="/home"><Home /></RoleGuard>} />
          <Route path="/dashboard" element={<RoleGuard path="/dashboard"><Reportes /></RoleGuard>} />
          <Route path="/reportes" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lavadas" element={<RoleGuard path="/lavadas"><Lavadas /></RoleGuard>} />
          <Route path="/clientes" element={<RoleGuard path="/clientes"><Clientes /></RoleGuard>} />
          <Route path="/pagos" element={<RoleGuard path="/pagos"><PlanGuard feature="Pago de Trabajadores"><PagoTrabajadores /></PlanGuard></RoleGuard>} />
          <Route path="/cuenta" element={<RoleGuard path="/cuenta"><Configuracion /></RoleGuard>} />
          <Route path="/admin" element={<RoleGuard path="/admin"><AdminDashboard /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </TourProvider>
    </DataProvider>
  )
}

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="loading-screen">Cargando...</div>
  }

  return (
    <ThemeProvider>
      <MoneyVisibilityProvider>
      <ToastProvider>
      <BrowserRouter>
        <Routes>
          {!session ? (
            <>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/registro" element={<Register />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <Route
              path="*"
              element={
                <TenantProvider session={session}>
                  <AuthenticatedApp session={session} />
                </TenantProvider>
              }
            />
          )}
        </Routes>
      </BrowserRouter>
      </ToastProvider>
      </MoneyVisibilityProvider>
    </ThemeProvider>
  )
}

export default App
