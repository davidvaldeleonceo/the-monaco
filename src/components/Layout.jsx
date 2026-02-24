import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useTenant } from './TenantContext'
import { useTheme } from './ThemeContext'
import { canAccess } from './RoleGuard'
import UpgradeModal from './UpgradeModal'
import {
  Home,
  LayoutDashboard,
  Users,
  Wallet,
  User,
  Settings,
  X,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react'

const PRO_ROUTES = ['/pagos']

const truncName = (name) => {
  if (!name) return 'monaco'
  const words = name.trim().split(/\s+/)
  return words.slice(0, 2).join(' ')
}

export default function Layout({ user }) {
  const navigate = useNavigate()
  const { negocioNombre, userProfile, isPro, planStatus, daysLeftInTrial } = useTenant()
  const appTitle = truncName(negocioNombre)
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const rol = userProfile?.rol || 'admin'
  const isAdmin = rol === 'admin'

  const topMenuItems = [
    { to: '/home', icon: Home, label: 'Home' },
  ]

  const mainMenuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Análisis' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/pagos', icon: Wallet, label: 'Trabajadores' },
  ]

  const filteredTop = topMenuItems.filter(item => canAccess(rol, item.to))
  const filteredMain = mainMenuItems.filter(item => canAccess(rol, item.to))

  const handleNavClick = () => {
    setMenuOpen(false)
  }

  return (
    <div className="layout">
      {/* Mobile Header */}
      <header className="mobile-header">
        <span className={`badge ${isPro ? '' : 'badge-free'} badge-clickable`} onClick={() => navigate('/cuenta?tab=plan')}>{isPro ? 'PRO' : 'FREE'}</span>
        <button onClick={toggleTheme} className="theme-switch" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
          <Sun size={14} className={`theme-switch-icon ${theme === 'light' ? 'active' : ''}`} />
          <Moon size={14} className={`theme-switch-icon ${theme === 'dark' ? 'active' : ''}`} />
        </button>
      </header>

      {/* Overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && <h1>{appTitle}</h1>}
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
          {filteredTop.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
              title={item.label}
            >
              <span className="nav-icon-wrap"><item.icon size={20} /></span>
              {!sidebarCollapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          <div className="sidebar-separator" />
          {filteredMain.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
              title={item.label}
            >
              <span className="nav-icon-wrap"><item.icon size={20} /></span>
              {!sidebarCollapsed && <span>{item.label}</span>}
              {!isPro && PRO_ROUTES.includes(item.to) && (
                <span className="pro-badge-nav">PRO</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-theme-area">
          <span className="sidebar-theme-label">Apariencia</span>
          <button onClick={toggleTheme} className="sidebar-theme-switch" title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            <Sun size={14} className={`sidebar-theme-icon ${theme === 'light' ? 'active' : ''}`} />
            <div className="sidebar-theme-thumb" />
            <Moon size={14} className={`sidebar-theme-icon ${theme === 'dark' ? 'active' : ''}`} />
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-row">
            {sidebarCollapsed ? (
              <>
                <NavLink to="/cuenta" className={({ isActive }) => `sidebar-footer-icon ${isActive ? 'active' : ''}`} onClick={handleNavClick} title="Mi Cuenta">
                  <User size={20} />
                </NavLink>
                {isAdmin && (
                  <NavLink to="/cuenta?tab=config" className="sidebar-footer-icon" onClick={handleNavClick} title="Configuración">
                    <Settings size={20} />
                  </NavLink>
                )}
              </>
            ) : (
              <>
                <NavLink to="/cuenta" className={({ isActive }) => `sidebar-footer-account ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                  <div className="user-avatar">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-details">
                    <span className="user-name">{user?.email?.split('@')[0]}</span>
                    <span className="user-role">{userProfile?.rol || 'Administrador'}</span>
                  </div>
                </NavLink>
                {isAdmin && (
                  <NavLink to="/cuenta?tab=config" className="sidebar-footer-icon" onClick={handleNavClick} title="Configuración">
                    <Settings size={20} />
                  </NavLink>
                )}
              </>
            )}
          </div>
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
