import { useTenant } from '../context/TenantContext'
import { ShieldAlert } from 'lucide-react'

const SUPERADMIN_EMAILS = ['principal@themonaco.com.co']

// Role hierarchy: admin > trabajador > viewer
const ROLE_ACCESS = {
  '/home':          ['admin', 'trabajador', 'viewer'],
  '/dashboard':     ['admin', 'trabajador', 'viewer'],
  '/lavadas':       ['admin', 'trabajador'],
  '/clientes':      ['admin', 'trabajador'],
  '/pagos':         ['admin'],
  '/cuenta':        ['admin', 'trabajador', 'viewer'],
}

export function getAccessibleRoutes(rol) {
  const role = (rol || 'admin').toLowerCase()
  return Object.entries(ROLE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([path]) => path)
}

export function canAccess(rol, path, email) {
  if (path === '/admin') return SUPERADMIN_EMAILS.includes(email)
  const role = (rol || 'admin').toLowerCase()
  const allowed = ROLE_ACCESS[path]
  if (!allowed) return false // unknown routes denied by default
  return allowed.includes(role)
}

export default function RoleGuard({ path, children }) {
  const { userProfile, userEmail } = useTenant()
  const rol = (userProfile?.rol || 'admin').toLowerCase()

  if (!canAccess(rol, path, userEmail)) {
    return (
      <div className="role-restricted-overlay">
        <ShieldAlert size={48} />
        <h2>Acceso restringido</h2>
        <p>No tienes permisos para acceder a esta sección.</p>
        <p style={{ fontSize: '0.85rem' }}>Tu rol: <strong>{rol}</strong></p>
      </div>
    )
  }

  return children
}
