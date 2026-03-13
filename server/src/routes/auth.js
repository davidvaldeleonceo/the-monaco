import { Router } from 'express'
import crypto from 'crypto'
import {
  createUser,
  findUserByEmail,
  comparePassword,
  buildSession,
  hashPassword,
} from '../services/authService.js'
import { sendPasswordResetEmail } from '../services/emailService.js'
import pool from '../config/database.js'
import env from '../config/env.js'
import auth from '../middleware/auth.js'
import logger from '../config/logger.js'

const router = Router()

// Rate limit map for forgot-password (email → [timestamps])
const resetRateLimit = new Map()

// POST /api/auth/signup
router.post('/signup', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const existing = await findUserByEmail(email)
    if (existing) {
      return res.status(400).json({ error: 'User already registered' })
    }

    const user = await createUser(email, password)
    const session = await buildSession(user)

    res.json({ data: { session, user: session.user }, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return res.status(400).json({ error: 'Invalid login credentials' })
    }

    const valid = await comparePassword(password, user.password_hash)
    if (!valid) {
      return res.status(400).json({ error: 'Invalid login credentials' })
    }

    const session = await buildSession(user)
    res.json({ data: { session, user: session.user }, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/verify-password
router.post('/verify-password', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      return res.json({ valid: false })
    }

    const valid = await comparePassword(password, user.password_hash)
    res.json({ valid })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/update-email
router.put('/update-email', auth, async (req, res, next) => {
  try {
    const { currentPassword, newEmail } = req.body
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ error: 'Current password and new email are required' })
    }

    const user = await findUserByEmail(req.user.email)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await comparePassword(currentPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' })

    const existing = await findUserByEmail(newEmail)
    if (existing) return res.status(400).json({ error: 'Ese correo ya está registrado' })

    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail.toLowerCase(), user.id])

    const session = await buildSession({ ...user, email: newEmail.toLowerCase() })
    res.json({ data: { session }, error: null })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/update-password
router.put('/update-password', auth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    const user = await findUserByEmail(req.user.email)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await comparePassword(currentPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' })

    const newHash = await hashPassword(newPassword)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, user.id])

    res.json({ data: { success: true }, error: null })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/session — returns current user from token
router.get('/session', async (req, res) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.json({ data: { session: null }, error: null })
  }

  try {
    const { verifyToken } = await import('../services/authService.js')
    const payload = verifyToken(header.slice(7))
    res.json({
      data: {
        session: {
          access_token: header.slice(7),
          user: { id: payload.sub, email: payload.email },
        },
      },
      error: null,
    })
  } catch {
    res.json({ data: { session: null }, error: null })
  }
})

// DELETE /api/auth/account — delete account and all business data (admin only)
router.delete('/account', auth, async (req, res, next) => {
  try {
    const userId = req.user.id
    const negocioId = req.user.negocio_id

    // Verify user is admin
    const { rows: profileRows } = await pool.query(
      'SELECT rol FROM user_profiles WHERE id = $1',
      [userId]
    )
    if (!profileRows.length || profileRows[0].rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar la cuenta' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Get all user IDs in this business before cascade deletes their profiles
      const { rows: userIds } = await client.query(
        'SELECT id FROM user_profiles WHERE negocio_id = $1',
        [negocioId]
      )
      await client.query('DELETE FROM negocios WHERE id = $1', [negocioId])
      // Delete all users (not just admin) to avoid orphaned records
      if (userIds.length > 0) {
        const ids = userIds.map(r => r.id)
        await client.query('DELETE FROM users WHERE id = ANY($1)', [ids])
      }
      await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ error: 'El correo es requerido' })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit: max 3 requests per email per hour
    const now = Date.now()
    const attempts = resetRateLimit.get(normalizedEmail) || []
    const recentAttempts = attempts.filter(t => now - t < 3600000)
    if (recentAttempts.length >= 3) {
      return res.json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' })
    }
    recentAttempts.push(now)
    resetRateLimit.set(normalizedEmail, recentAttempts)

    // Always return same response (don't reveal if email exists)
    const successMsg = { message: 'Si el correo existe, recibirás un enlace de recuperación.' }

    const user = await findUserByEmail(normalizedEmail)
    if (!user) {
      return res.json(successMsg)
    }

    // Invalidate previous tokens for this user
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1 AND used = false',
      [user.id]
    )

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + 3600000) // 1 hour

    await pool.query(
      'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
      [user.id, tokenHash, expiresAt]
    )

    // Send email
    const frontendUrl = env.frontendUrl
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`

    try {
      await sendPasswordResetEmail(normalizedEmail, resetUrl)
    } catch (err) {
      logger.error('Failed to send reset email:', err.message)
      return res.status(500).json({ error: 'Error al enviar el correo. Intenta más tarde.' })
    }

    res.json(successMsg)
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body
    if (!token || !password) {
      return res.status(400).json({ error: 'Token y contraseña son requeridos' })
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

    const { rows } = await pool.query(
      `SELECT pr.*, u.email FROM password_resets pr
       JOIN users u ON u.id = pr.user_id
       WHERE pr.token_hash = $1 AND pr.used = false AND pr.expires_at > now()`,
      [tokenHash]
    )

    if (rows.length === 0) {
      return res.status(400).json({ error: 'El enlace es inválido o ya expiró. Solicita uno nuevo.' })
    }

    const resetRecord = rows[0]

    // Update password
    const newHash = await hashPassword(password)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, resetRecord.user_id])

    // Mark all tokens as used for this user
    await pool.query(
      'UPDATE password_resets SET used = true WHERE user_id = $1',
      [resetRecord.user_id]
    )

    logger.info(`Password reset completed for ${resetRecord.email}`)
    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (err) {
    next(err)
  }
})

export default router
