import { Router } from 'express'
import pool from '../config/database.js'

const router = Router()

// GET /api/admin/overview — global stats
router.get('/overview', async (_req, res) => {
  try {
    const [usuarios, negocios, lavadas, revenue, lavadas7d] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query(`
        SELECT COUNT(*) AS total,
               COUNT(*) FILTER (WHERE subscription_expires_at > now()) AS pro_pagado,
               COUNT(*) FILTER (WHERE trial_ends_at > now() AND (subscription_expires_at IS NULL OR subscription_expires_at < now())) AS trial_activo,
               COUNT(*) FILTER (WHERE (trial_ends_at IS NULL OR trial_ends_at < now()) AND (subscription_expires_at IS NULL OR subscription_expires_at < now())) AS free_o_vencido
        FROM negocios
      `),
      pool.query('SELECT COUNT(*) FROM lavadas'),
      pool.query(`
        SELECT COALESCE(SUM(monto), 0) AS total_revenue,
               COUNT(*) AS total_pagos
        FROM pagos_suscripcion
        WHERE estado = 'APPROVED'
      `),
      pool.query(`
        SELECT COUNT(*) FROM lavadas
        WHERE fecha > now() - interval '7 days'
      `),
    ])

    res.json({
      usuarios: parseInt(usuarios.rows[0].count),
      negocios: negocios.rows[0],
      lavadas_total: parseInt(lavadas.rows[0].count),
      lavadas_7d: parseInt(lavadas7d.rows[0].count),
      revenue: {
        total: parseInt(revenue.rows[0].total_revenue),
        pagos: parseInt(revenue.rows[0].total_pagos),
      },
    })
  } catch (err) {
    console.error('Admin overview error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/negocios — all businesses with metrics
router.get('/negocios', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        n.id,
        n.nombre,
        n.plan,
        n.trial_ends_at,
        n.subscription_expires_at,
        n.created_at,
        n.telefono,
        u.email,
        up.nombre AS user_nombre,
        (SELECT COUNT(*) FROM lavadas l WHERE l.negocio_id = n.id) AS lavadas_total,
        (SELECT COUNT(*) FROM lavadas l WHERE l.negocio_id = n.id AND l.fecha > now() - interval '7 days') AS lavadas_7d,
        (SELECT COUNT(*) FROM clientes c WHERE c.negocio_id = n.id) AS clientes,
        (SELECT COUNT(*) FROM lavadores lv WHERE lv.negocio_id = n.id AND lv.activo = true) AS lavadores,
        (SELECT MAX(l.fecha) FROM lavadas l WHERE l.negocio_id = n.id) AS ultima_lavada
      FROM negocios n
      LEFT JOIN user_profiles up ON up.negocio_id = n.id AND up.rol = 'admin'
      LEFT JOIN users u ON u.id = up.id
      ORDER BY n.created_at DESC
    `)
    res.json(rows)
  } catch (err) {
    console.error('Admin negocios error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/actividad — daily lavadas last 30 days
router.get('/actividad', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        (fecha AT TIME ZONE 'America/Bogota')::date AS dia,
        COUNT(*) AS lavadas,
        COUNT(DISTINCT negocio_id) AS negocios_activos
      FROM lavadas
      WHERE fecha > now() - interval '30 days'
      GROUP BY dia
      ORDER BY dia
    `)
    res.json(rows)
  } catch (err) {
    console.error('Admin actividad error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/admin/revenue — subscription payments
router.get('/revenue', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        ps.id,
        ps.monto,
        ps.estado,
        ps.periodo,
        ps.periodo_desde,
        ps.periodo_hasta,
        ps.created_at,
        n.nombre AS negocio
      FROM pagos_suscripcion ps
      LEFT JOIN negocios n ON n.id = ps.negocio_id
      ORDER BY ps.created_at DESC
      LIMIT 50
    `)
    res.json(rows)
  } catch (err) {
    console.error('Admin revenue error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/admin/negocios/:id — update negocio fields (nombre, plan, trial, subscription)
router.patch('/negocios/:id', async (req, res) => {
  try {
    const { id } = req.params
    const allowed = ['nombre', 'plan', 'trial_ends_at', 'subscription_expires_at']
    const sets = []
    const values = []
    let idx = 1
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        sets.push(`${key} = $${idx}`)
        values.push(req.body[key])
        idx++
      }
    }
    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' })
    values.push(id)
    const { rows } = await pool.query(
      `UPDATE negocios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Negocio not found' })
    res.json(rows[0])
  } catch (err) {
    console.error('Admin update negocio error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/admin/negocios/:id — delete negocio and all related data (CASCADE)
router.delete('/negocios/:id', async (req, res) => {
  try {
    const { id } = req.params
    // Delete user_profiles and users linked to this negocio
    const { rows: profiles } = await pool.query('SELECT id FROM user_profiles WHERE negocio_id = $1', [id])
    for (const p of profiles) {
      await pool.query('DELETE FROM user_profiles WHERE id = $1', [p.id])
      await pool.query('DELETE FROM users WHERE id = $1', [p.id])
    }
    // Delete negocio (CASCADE deletes all business data)
    await pool.query('DELETE FROM negocios WHERE id = $1', [id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Admin delete negocio error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PATCH /api/admin/users/:id — update user email
router.patch('/users/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { email, nombre } = req.body
    if (email) await pool.query('UPDATE users SET email = $1 WHERE id = $2', [email, id])
    if (nombre !== undefined) await pool.query('UPDATE user_profiles SET nombre = $1 WHERE id = $2', [nombre, id])
    res.json({ ok: true })
  } catch (err) {
    console.error('Admin update user error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
