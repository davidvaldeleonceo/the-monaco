import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Register from './components/Register'
import Layout from './components/Layout'
import Lavadas from './components/Lavadas'
import Clientes from './components/Clientes'
import Reportes from './components/Reportes'
import PagoTrabajadores from './components/PagoTrabajadores'
import Configuracion from './components/Configuracion'
import Home from './components/Home'
import LandingPage from './components/LandingPage'
import { DataProvider } from './components/DataContext'
import { TenantProvider, useTenant } from './components/TenantContext'
import { ThemeProvider } from './components/ThemeContext'
import { MoneyVisibilityProvider } from './components/MoneyVisibilityContext'
import { ToastProvider } from './components/Toast'
import Onboarding from './components/Onboarding'
import SetupWizard from './components/SetupWizard'
import RoleGuard from './components/RoleGuard'
import PlanGuard from './components/PlanGuard'
import { TourProvider } from './components/AppTour'
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
