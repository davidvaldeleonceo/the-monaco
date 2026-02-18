import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Register from './components/Register'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Lavadas from './components/Lavadas'
import Clientes from './components/Clientes'
import Balance from './components/Balance'
import Reportes from './components/Reportes'
import Tareas from './components/Tareas'
import PagoTrabajadores from './components/PagoTrabajadores'
import Configuracion from './components/Configuracion'
import Home from './components/Home'
import Membresias from './components/Membresias'
import LandingPage from './components/LandingPage'
import { DataProvider } from './components/DataContext'
import { TenantProvider, useTenant } from './components/TenantContext'
import { ThemeProvider } from './components/ThemeContext'
import Onboarding from './components/Onboarding'
import SetupWizard from './components/SetupWizard'
import RoleGuard from './components/RoleGuard'
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
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route element={<Layout user={session.user} />}>
          <Route path="/home" element={<RoleGuard path="/home"><Home /></RoleGuard>} />
          <Route path="/dashboard" element={<RoleGuard path="/dashboard"><Dashboard /></RoleGuard>} />
          <Route path="/lavadas" element={<RoleGuard path="/lavadas"><Lavadas /></RoleGuard>} />
          <Route path="/clientes" element={<RoleGuard path="/clientes"><Clientes /></RoleGuard>} />
          <Route path="/balance" element={<RoleGuard path="/balance"><Balance /></RoleGuard>} />
          <Route path="/reportes" element={<RoleGuard path="/reportes"><Reportes /></RoleGuard>} />
          <Route path="/tareas" element={<RoleGuard path="/tareas"><Tareas /></RoleGuard>} />
          <Route path="/pagos" element={<RoleGuard path="/pagos"><PagoTrabajadores /></RoleGuard>} />
          <Route path="/membresias" element={<RoleGuard path="/membresias"><Membresias /></RoleGuard>} />
          <Route path="/configuracion" element={<RoleGuard path="/configuracion"><Configuracion /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
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
    </ThemeProvider>
  )
}

export default App
