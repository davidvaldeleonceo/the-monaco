/**
 * Middleware that enforces tenant isolation.
 * Injects negocio_id filter on reads and writes.
 *
 * Tables that DON'T have negocio_id or are queried by user ID are excluded.
 * user_profiles is unscoped because it's queried by auth user ID during login.
 */

const UNSCOPED_TABLES = new Set(['users', 'negocios', 'user_profiles'])

export default function tenantScope(req, res, next) {
  const negocioId = req.user?.negocio_id

  // req.params.table isn't available here (set by sub-router later),
  // so extract table name from the URL path.
  const table = req.params.table || req.path.split('/').filter(Boolean)[0]
  if (UNSCOPED_TABLES.has(table)) {
    req.negocioId = negocioId
    req.isScoped = false
    return next()
  }

  if (!negocioId) {
    return res.status(403).json({ error: 'No negocio associated with this user' })
  }

  req.negocioId = negocioId
  req.isScoped = true
  next()
}
