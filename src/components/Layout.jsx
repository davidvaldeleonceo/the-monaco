import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { useTenant } from './TenantContext'
import { canAccess } from './RoleGuard'
import {
  LayoutDashboard,
  Droplets,
  Users,
  DollarSign,
  FileText,
  CheckSquare,
  Wallet,
  CreditCard,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export default function Layout({ user }) {
  const navigate = useNavigate()
  const { negocioNombre, userProfile } = useTenant()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const rol = userProfile?.rol || 'admin'

  const allMenuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lavadas', icon: Droplets, label: 'Servicios' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/balance', icon: DollarSign, label: 'Balance' },
    { to: '/reportes', icon: FileText, label: 'Reportes' },
    { to: '/tareas', icon: CheckSquare, label: 'Control Tareas' },
    { to: '/membresias', icon: CreditCard, label: 'Membresías' },
    { to: '/pagos', icon: Wallet, label: 'Pago Trabajadores' },
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
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
        <span className="badge">PRO</span>
      </header>

      {/* Overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          {!sidebarCollapsed && <h1>monaco</h1>}
          {!sidebarCollapsed && <span className="badge">PRO</span>}
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
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarCollapsed ? (
            <button onClick={handleLogout} className="logout-button" title="Cerrar sesión">
              <LogOut size={20} />
            </button>
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
              <button onClick={handleLogout} className="logout-button" title="Cerrar sesión">
                <LogOut size={20} />
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
