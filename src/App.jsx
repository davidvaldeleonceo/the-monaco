import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Lavadas from './components/Lavadas'
import Clientes from './components/Clientes'
import Balance from './components/Balance'
import Reportes from './components/Reportes'
import Tareas from './components/Tareas'
import PagoTrabajadores from './components/PagoTrabajadores'
import Configuracion from './components/Configuracion'
import { DataProvider } from './components/DataContext'
import './App.css'

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
      <DataProvider>
        <Routes>
          {!session ? (
            <>
              <Route path="/" element={<Login />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<Layout user={session.user} />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/lavadas" element={<Lavadas />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/balance" element={<Balance />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/tareas" element={<Tareas />} />
                <Route path="/pagos" element={<PagoTrabajadores />} />
                <Route path="/configuracion" element={<Configuracion />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </>
          )}
        </Routes>
      </DataProvider>
    </BrowserRouter>
  )
}

export default App