/**
 * Bootstrap endpoint — returns all data the frontend needs in a single round-trip.
 * Replaces: TenantContext fetch + DataContext 10 queries + Home transacciones fetch.
 */
import { Router } from 'express'
import pool from '../config/database.js'
import { getTimezone } from '../config/currencies.js'

const router = Router()

function getCutoff60Days() {
  const d = new Date()
  d.setDate(d.getDate() - 60)
  return d.toISOString()
}

function getCurrentMonthRange(tz = 'America/Bogota') {
  const now = new Date()
  const bogota = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  const y = bogota.getFullYear()
  const m = String(bogota.getMonth() + 1).padStart(2, '0')
  const desde = `${y}-${m}-01`
  // Next month first day
  const nextMonth = bogota.getMonth() + 2 > 12 ? 1 : bogota.getMonth() + 2
  const nextYear = bogota.getMonth() + 2 > 12 ? y + 1 : y
  const hasta = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { desde, hasta }
}

router.get('/', async (req, res, next) => {
  try {
    const userId = req.user.id
    const negocioId = req.user.negocio_id

    // If user has no negocio, return just the profile status
    if (!negocioId) {
      const { rows: profileRows } = await pool.query(
        `SELECT up.*, json_build_object(
          'id', n.id, 'nombre', n.nombre, 'setup_complete', n.setup_complete,
          'plan', n.plan, 'trial_ends_at', n.trial_ends_at,
          'subscription_expires_at', n.subscription_expires_at,
          'subscription_period', n.subscription_period,
          'moneda', n.moneda, 'pais', n.pais
        ) AS negocio
        FROM user_profiles up
        LEFT JOIN negocios n ON n.id = up.negocio_id
        WHERE up.id = $1`,
        [userId]
      )
      return res.json({
        profile: profileRows[0] || null,
        data: null,
      })
    }

    const cutoff = getCutoff60Days()
    const { rows: [negRow] } = await pool.query('SELECT pais FROM negocios WHERE id = $1', [negocioId])
    const tz = getTimezone(negRow?.pais || 'CO')
    const { desde, hasta } = getCurrentMonthRange(tz)

    // Run ALL queries in parallel
    const [
      profileRes,
      clientesRes,
      lavadasRes,
      tiposLavadoRes,
      lavadoresRes,
      metodosPagoRes,
      tiposMembresiaRes,
      serviciosAdicionalesRes,
      productosRes,
      plantillasRes,
      categoriasTransaccionRes,
      transaccionesRes,
    ] = await Promise.all([
      // Profile + negocio
      pool.query(
        `SELECT up.*, json_build_object(
          'id', n.id, 'nombre', n.nombre, 'setup_complete', n.setup_complete,
          'plan', n.plan, 'trial_ends_at', n.trial_ends_at,
          'subscription_expires_at', n.subscription_expires_at,
          'subscription_period', n.subscription_period,
          'moneda', n.moneda, 'pais', n.pais
        ) AS negocio
        FROM user_profiles up
        LEFT JOIN negocios n ON n.id = up.negocio_id
        WHERE up.id = $1`,
        [userId]
      ),
      // Clientes with membresia join
      pool.query(
        `SELECT c.*, json_build_object('nombre', tm.nombre) AS membresia
        FROM clientes c
        LEFT JOIN tipos_membresia tm ON tm.id = c.membresia_id
        WHERE c.negocio_id = $1
        ORDER BY c.nombre ASC`,
        [negocioId]
      ),
      // Lavadas (last 60 days) with joins
      pool.query(
        `SELECT l.*,
          json_build_object('nombre', cl.nombre) AS cliente,
          json_build_object('nombre', tl.nombre) AS tipo_lavado,
          json_build_object('nombre', lv.nombre) AS lavador,
          json_build_object('nombre', mp.nombre) AS metodo_pago
        FROM lavadas l
        LEFT JOIN clientes cl ON cl.id = l.cliente_id
        LEFT JOIN tipos_lavado tl ON tl.id = l.tipo_lavado_id
        LEFT JOIN lavadores lv ON lv.id = l.lavador_id
        LEFT JOIN metodos_pago mp ON mp.id = l.metodo_pago_id
        WHERE l.negocio_id = $1 AND l.fecha >= $2
        ORDER BY l.fecha DESC
        LIMIT 500`,
        [negocioId, cutoff]
      ),
      // Config tables
      pool.query('SELECT * FROM tipos_lavado WHERE negocio_id = $1 AND activo = true', [negocioId]),
      pool.query('SELECT * FROM lavadores WHERE negocio_id = $1 AND activo = true', [negocioId]),
      pool.query('SELECT * FROM metodos_pago WHERE negocio_id = $1 AND activo = true', [negocioId]),
      pool.query('SELECT * FROM tipos_membresia WHERE negocio_id = $1 AND activo = true', [negocioId]),
      pool.query('SELECT * FROM servicios_adicionales WHERE negocio_id = $1 AND activo = true ORDER BY nombre ASC', [negocioId]),
      pool.query('SELECT * FROM productos WHERE negocio_id = $1 ORDER BY nombre ASC', [negocioId]),
      pool.query('SELECT * FROM plantillas_mensaje WHERE negocio_id = $1 AND activo = true ORDER BY nombre ASC', [negocioId]),
      pool.query('SELECT * FROM categorias_transaccion WHERE negocio_id = $1 AND activo = true ORDER BY nombre ASC', [negocioId]),
      // Transacciones for current month
      pool.query(
        `SELECT t.*, json_build_object('nombre', mp.nombre) AS metodo_pago
        FROM transacciones t
        LEFT JOIN metodos_pago mp ON mp.id = t.metodo_pago_id
        WHERE t.negocio_id = $1 AND t.fecha >= $2 AND t.fecha < $3
        ORDER BY t.fecha DESC, t.created_at DESC`,
        [negocioId, desde, hasta]
      ),
    ])

    res.json({
      profile: profileRes.rows[0] || null,
      data: {
        clientes: clientesRes.rows,
        lavadas: lavadasRes.rows,
        tiposLavado: tiposLavadoRes.rows,
        lavadores: lavadoresRes.rows,
        metodosPago: metodosPagoRes.rows,
        tiposMembresia: tiposMembresiaRes.rows,
        serviciosAdicionales: serviciosAdicionalesRes.rows,
        productos: productosRes.rows,
        plantillasMensaje: plantillasRes.rows,
        categoriasTransaccion: categoriasTransaccionRes.rows,
        transacciones: transaccionesRes.rows,
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
