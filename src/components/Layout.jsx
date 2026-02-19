import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { useTheme } from './ThemeContext'
import { canAccess } from './RoleGuard'
import UpgradeModal from './UpgradeModal'
import {
  Home,
  LayoutDashboard,
  Droplets,
  Users,
  DollarSign,
  FileText,
  CheckSquare,
  Wallet,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon
} from 'lucide-react'

const PRO_ROUTES = ['/pagos', '/membresias']

export default function Layout({ user }) {
  const navigate = useNavigate()
  const { negocioNombre, userProfile, isPro, planStatus, daysLeftInTrial } = useTenant()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const rol = userProfile?.rol || 'admin'
  const isAdmin = rol === 'admin'

  const allMenuItems = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Análisis' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/balance', icon: DollarSign, label: 'Balance' },
    { to: '/reportes', icon: FileText, label: 'Reportes' },
    { to: '/tareas', icon: CheckSquare, label: 'Control Tareas' },
    { to: '/membresias', icon: CreditCard, label: 'Membresías' },
    { to: '/pagos', icon: Wallet, label: 'Pago Trabajadores' },
    { to: '/cuenta', icon: User, label: 'Mi Cuenta' },
  ]

  const menuItems = allMenuItems.filter(item => canAccess(rol, item.to))

  const handleNavClick = () => {
    setMenuOpen(false)
  }

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <h1 className="mobile-title">monaco</h1>
        <span className={`badge ${isPro ? '' : 'badge-free'} badge-clickable`} onClick={() => navigate('/cuenta?tab=plan')}>{isPro ? 'PRO' : 'FREE'}</span>
      </header>

      {/* Overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && <h1>monaco</h1>}
          {!sidebarCollapsed && <span className={`badge ${isPro ? '' : 'badge-free'} badge-clickable`} onClick={() => navigate('/cuenta?tab=plan')}>{isPro ? 'PRO' : 'FREE'}</span>}
          <button
            className="sidebar-close-btn"
            onClick={() => setMenuOpen(false)}
            title="Cerrar menú"
          >
            <X size={20} />
          </button>
          <button
            className="sidebar-collapse-btn"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
              title={item.label}
            >
              <item.icon size={20} />
              {!sidebarCollapsed && <span>{item.label}</span>}
              {!isPro && PRO_ROUTES.includes(item.to) && (
                <span className="pro-badge-nav">PRO</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarCollapsed ? (
            <>
              <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button onClick={handleLogout} className="logout-button" title="Cerrar sesión">
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <>
              <div className="user-info">
                <div className="user-avatar">
                  {user?.email?.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <span className="user-name">{user?.email?.split('@')[0]}</span>
                  <span className="user-role">{userProfile?.rol || 'Administrador'}</span>
                </div>
              </div>
              <button onClick={toggleTheme} className="theme-toggle-btn" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                <span>{theme === 'dark' ? 'Claro' : 'Oscuro'}</span>
              </button>
              <button onClick={handleLogout} className="logout-button" title="Cerrar sesión">
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="main-content">
        {planStatus === 'trial' && daysLeftInTrial <= 5 && (
          <div className="plan-banner plan-banner--trial">
            Te quedan {daysLeftInTrial} día{daysLeftInTrial !== 1 ? 's' : ''} de prueba PRO.
            {isAdmin && <button className="plan-banner-btn" onClick={() => setShowUpgradeModal(true)}>Suscribirse</button>}
          </div>
        )}
        {planStatus === 'free' && isAdmin && (
          <div className="plan-banner plan-banner--free">
            Estás en el plan gratuito (50 lavadas/mes, 30 clientes).
            <button className="plan-banner-btn" onClick={() => setShowUpgradeModal(true)}>Actualizar a PRO</button>
          </div>
        )}
        <Outlet />
        {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
      </main>

      <nav className="floating-bottom-bar">
        {[
          { to: '/home', icon: Home, label: 'Home' },
          { to: '/dashboard', icon: LayoutDashboard, label: 'Análisis' },
          { to: '/clientes', icon: Users, label: 'Clientes' },
          { to: '/pagos', icon: Wallet, label: 'Trabajadores' },
          { to: '/cuenta', icon: User, label: 'Cuenta' },
        ].map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `fbb-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
