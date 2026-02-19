import { Router } from 'express'
import pool from '../config/database.js'
import { seedNegocio } from '../db/seed.js'
import { signToken } from '../services/authService.js'

const router = Router()

/**
 * Issue a fresh JWT with updated negocio_id.
 */
function issueNewSession(userId, email, negocioId) {
  const token = signToken({ sub: userId, email, negocio_id: negocioId })
  return {
    access_token: token,
    user: { id: userId, email },
  }
}

/**
 * POST /api/rpc/register_negocio
 * Called by Register.jsx after signup (when session is available immediately).
 * Params: p_nombre_negocio, p_nombre_usuario, p_email, p_user_id
 */
router.post('/register_negocio', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { p_nombre_negocio, p_nombre_usuario, p_email, p_user_id } = req.body

    await client.query('BEGIN')

    // Create negocio with 14-day PRO trial
    const { rows: [negocio] } = await client.query(
      "INSERT INTO negocios (nombre, plan, trial_ends_at) VALUES ($1, 'pro', now() + INTERVAL '14 days') RETURNING id",
      [p_nombre_negocio]
    )

    // Create user_profile linking user to negocio
    await client.query(
      `INSERT INTO user_profiles (id, negocio_id, nombre, rol) VALUES ($1, $2, $3, 'admin')`,
      [p_user_id, negocio.id, p_nombre_usuario || p_email?.split('@')[0] || '']
    )

    // Seed default data (inside transaction)
    await seedNegocio(negocio.id, client)

    await client.query('COMMIT')

    // Return new session with negocio_id embedded in JWT
    const session = issueNewSession(p_user_id, p_email, negocio.id)
    res.json({ data: negocio.id, error: null, session })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

/**
 * POST /api/rpc/crear_negocio_y_perfil
 * Called by TenantContext/Onboarding after email confirmation.
 * Uses the authenticated user from JWT.
 * Params: p_nombre, p_email
 */
router.post('/crear_negocio_y_perfil', async (req, res, next) => {
  const client = await pool.connect()
  try {
    const { p_nombre, p_email } = req.body
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    await client.query('BEGIN')

    // Create negocio with 14-day PRO trial
    const { rows: [negocio] } = await client.query(
      "INSERT INTO negocios (nombre, plan, trial_ends_at) VALUES ($1, 'pro', now() + INTERVAL '14 days') RETURNING id",
      [p_nombre]
    )

    // Create user_profile
    await client.query(
      `INSERT INTO user_profiles (id, negocio_id, nombre, rol) VALUES ($1, $2, $3, 'admin')`,
      [userId, negocio.id, p_email?.split('@')[0] || '']
    )

    // Seed default data (inside transaction)
    await seedNegocio(negocio.id, client)

    await client.query('COMMIT')

    // Return new session with negocio_id embedded in JWT
    const session = issueNewSession(userId, req.user.email, negocio.id)
    res.json({ data: negocio.id, error: null, session })
  } catch (err) {
    await client.query('ROLLBACK')
    next(err)
  } finally {
    client.release()
  }
})

/**
 * POST /api/rpc/complete_setup
 * Marks the negocio's initial setup wizard as complete.
 */
router.post('/complete_setup', async (req, res, next) => {
  try {
    const negocioId = req.user?.negocio_id
    if (!negocioId) return res.status(401).json({ error: 'No negocio' })
    await pool.query('UPDATE negocios SET setup_complete = true WHERE id = $1', [negocioId])
    res.json({ data: true, error: null })
  } catch (err) { next(err) }
})

export default router
