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
import Membresias from './components/Membresias'
import { DataProvider } from './components/DataContext'
import { TenantProvider, useTenant } from './components/TenantContext'
import Onboarding from './components/Onboarding'
import './App.css'

function AuthenticatedApp({ session }) {
  const { loading, needsOnboarding } = useTenant()

  if (loading) {
    return <div className="loading-screen">Cargando...</div>
  }

  if (needsOnboarding) {
    return <Onboarding />
  }

  return (
    <DataProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route element={<Layout user={session.user} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/lavadas" element={<Lavadas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/balance" element={<Balance />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/tareas" element={<Tareas />} />
          <Route path="/pagos" element={<PagoTrabajadores />} />
          <Route path="/membresias" element={<Membresias />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
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
    <BrowserRouter>
      <Routes>
        {!session ? (
          <>
            <Route path="/registro" element={<Register />} />
            <Route path="/" element={<Login />} />
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
  )
}

export default App
