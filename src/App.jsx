import { useState, useEffect, useLayoutEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useIsMobile from './hooks/useIsMobile'
import { supabase } from './apiClient'
import Layout from './components/layout/Layout'
import { DataProvider } from './components/context/DataContext'
import { TenantProvider, useTenant } from './components/context/TenantContext'
import { ThemeProvider } from './components/context/ThemeContext'
import { MoneyVisibilityProvider } from './components/context/MoneyVisibilityContext'
import { ToastProvider } from './components/layout/Toast'
import RoleGuard from './components/guards/RoleGuard'
// PlanGuard removed — free plan now uses backend limits instead of full-page blocks
import { TourProvider } from './components/layout/AppTour'
import './App.css'

// Lazy: pages (loaded on demand)
const Home = lazy(() => import('./components/pages/Home'))
const Lavadas = lazy(() => import('./components/pages/Lavadas'))
const Clientes = lazy(() => import('./components/pages/Clientes'))
const Reportes = lazy(() => import('./components/pages/Reportes'))
const PagoTrabajadores = lazy(() => import('./components/pages/PagoTrabajadores'))
const Configuracion = lazy(() => import('./components/pages/Configuracion'))
const AdminDashboard = lazy(() => import('./components/Admin/AdminDashboard'))

// Lazy: unauthenticated pages
const LandingPage = lazy(() => import('./components/pages/LandingPage'))
const Login = lazy(() => import('./components/auth/Login'))
const Register = lazy(() => import('./components/auth/Register'))
const ForgotPassword = lazy(() => import('./components/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./components/auth/ResetPassword'))
const Onboarding = lazy(() => import('./components/auth/Onboarding'))
const SetupWizard = lazy(() => import('./components/auth/SetupWizard'))

function ForceLightMode({ children }) {
  useLayoutEffect(() => {
    const prev = document.documentElement.dataset.theme
    document.documentElement.dataset.theme = 'light'
    return () => { document.documentElement.dataset.theme = prev || 'light' }
  }, [])
  return children
}

function MobileRedirect({ to, children }) {
  const isMobile = useIsMobile()
  if (isMobile) return <Navigate to={to} replace />
  return children
}

function AuthenticatedApp({ session }) {
  const { loading, needsOnboarding, needsSetup } = useTenant()

  if (loading) {
    return <div className="loading-screen">Cargando...</div>
  }

  if (needsOnboarding) {
    return <Suspense fallback={<div className="loading-screen">Cargando...</div>}><Onboarding /></Suspense>
  }

  if (needsSetup) {
    return <Suspense fallback={<div className="loading-screen">Cargando...</div>}><SetupWizard /></Suspense>
  }

  return (
    <DataProvider>
      <TourProvider>
      <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route element={<Layout user={session.user} />}>
          <Route path="/home" element={<RoleGuard path="/home"><Home /></RoleGuard>} />
          <Route path="/dashboard" element={<RoleGuard path="/dashboard"><Reportes /></RoleGuard>} />
          <Route path="/reportes" element={<Navigate to="/dashboard" replace />} />
          <Route path="/lavadas" element={<RoleGuard path="/lavadas"><Lavadas /></RoleGuard>} />
          <Route path="/clientes" element={<RoleGuard path="/clientes"><MobileRedirect to="/home?tab=clientes"><Clientes /></MobileRedirect></RoleGuard>} />
          <Route path="/pagos" element={<RoleGuard path="/pagos"><MobileRedirect to="/home?tab=trabajadores"><PagoTrabajadores /></MobileRedirect></RoleGuard>} />
          <Route path="/cuenta" element={<RoleGuard path="/cuenta"><Configuracion /></RoleGuard>} />
          <Route path="/admin" element={<RoleGuard path="/admin"><AdminDashboard /></RoleGuard>} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      </Suspense>
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
      // Prefetch Home chunk while React re-renders the authenticated app
      if (session) {
        import('./components/pages/Home')
      }
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
              <Route path="/" element={<ForceLightMode><Suspense fallback={<div className="loading-screen">Cargando...</div>}><LandingPage /></Suspense></ForceLightMode>} />
              <Route path="/login" element={<ForceLightMode><Suspense fallback={<div className="loading-screen">Cargando...</div>}><Login /></Suspense></ForceLightMode>} />
              <Route path="/registro" element={<ForceLightMode><Suspense fallback={<div className="loading-screen">Cargando...</div>}><Register /></Suspense></ForceLightMode>} />
              <Route path="/forgot-password" element={<ForceLightMode><Suspense fallback={<div className="loading-screen">Cargando...</div>}><ForgotPassword /></Suspense></ForceLightMode>} />
              <Route path="/reset-password" element={<ForceLightMode><Suspense fallback={<div className="loading-screen">Cargando...</div>}><ResetPassword /></Suspense></ForceLightMode>} />
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
