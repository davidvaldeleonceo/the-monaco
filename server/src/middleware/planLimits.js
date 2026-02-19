import pool from '../config/database.js'

function computeIsPro(negocio) {
  const now = new Date()
  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) return true
  if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) return true
  return false
}

export default async function planLimits(req, res, next) {
  try {
    if (req.method !== 'POST') return next()

    const table = req.params.table || req.path.split('/').filter(Boolean)[0]
    if (!table) return next()

    const negocioId = req.negocioId
    if (!negocioId) return next()

    if (table !== 'lavadas' && table !== 'clientes') return next()

    const { rows } = await pool.query(
      'SELECT plan, trial_ends_at, subscription_expires_at FROM negocios WHERE id = $1',
      [negocioId]
    )
    const negocio = rows[0]
    if (!negocio) return next()

    if (computeIsPro(negocio)) return next()

    if (table === 'lavadas') {
      const { rows: countRows } = await pool.query(
        `SELECT COUNT(*) FROM lavadas
         WHERE negocio_id = $1
         AND fecha >= date_trunc('month', now())`,
        [negocioId]
      )
      if (parseInt(countRows[0].count) >= 50) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          limit: 50,
          resource: 'lavadas'
        })
      }
    }

    if (table === 'clientes') {
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*) FROM clientes WHERE negocio_id = $1',
        [negocioId]
      )
      if (parseInt(countRows[0].count) >= 30) {
        return res.status(403).json({
          error: 'PLAN_LIMIT_REACHED',
          limit: 30,
          resource: 'clientes'
        })
      }
    }

    next()
  } catch (err) {
    next(err)
  }
}
