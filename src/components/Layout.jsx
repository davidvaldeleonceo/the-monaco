import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import {
  LayoutDashboard,
  Droplets,
  Users,
  DollarSign,
  FileText,
  CheckSquare,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X
} from 'lucide-react'

export default function Layout({ user }) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const menuItems = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/lavadas', icon: Droplets, label: 'Lavadas' },
    { to: '/clientes', icon: Users, label: 'Clientes' },
    { to: '/balance', icon: DollarSign, label: 'Balance' },
    { to: '/reportes', icon: FileText, label: 'Reportes' },
    { to: '/tareas', icon: CheckSquare, label: 'Control Tareas' },
    { to: '/pagos', icon: Wallet, label: 'Pago Trabajadores' },
    { to: '/configuracion', icon: Settings, label: 'Configuración' },
  ]

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
        <h1 className="mobile-title">Monaco</h1>
        <span className="badge">PRO</span>
      </header>

      {/* Overlay */}
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>Monaco</h1>
          <span className="badge">PRO</span>
        </div>

        <nav className="sidebar-nav">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={handleNavClick}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
              <span className="user-name">{user?.email?.split('@')[0]}</span>
              <span className="user-role">Administrador</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
