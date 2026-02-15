import { useTenant } from './TenantContext'
import { ShieldAlert } from 'lucide-react'

// Role hierarchy: admin > trabajador > viewer
const ROLE_ACCESS = {
  '/dashboard':     ['admin', 'trabajador', 'viewer'],
  '/lavadas':       ['admin', 'trabajador'],
  '/clientes':      ['admin', 'trabajador'],
  '/balance':       ['admin'],
  '/reportes':      ['admin'],
  '/tareas':        ['admin', 'trabajador'],
  '/membresias':    ['admin'],
  '/pagos':         ['admin'],
  '/configuracion': ['admin'],
}

export function getAccessibleRoutes(rol) {
  const role = (rol || 'admin').toLowerCase()
  return Object.entries(ROLE_ACCESS)
    .filter(([, roles]) => roles.includes(role))
    .map(([path]) => path)
}

export function canAccess(rol, path) {
  const role = (rol || 'admin').toLowerCase()
  const allowed = ROLE_ACCESS[path]
  if (!allowed) return true // unknown routes default to allowed
  return allowed.includes(role)
}

export default function RoleGuard({ path, children }) {
  const { userProfile } = useTenant()
  const rol = (userProfile?.rol || 'admin').toLowerCase()

  if (!canAccess(rol, path)) {
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
