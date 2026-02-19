import { Router } from 'express'
import {
  createUser,
  findUserByEmail,
  comparePassword,
  buildSession,
} from '../services/authService.js'

const router = Router()

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
router.put('/update-email', async (req, res, next) => {
  try {
    const { currentPassword, newEmail } = req.body
    if (!currentPassword || !newEmail) {
      return res.status(400).json({ error: 'Current password and new email are required' })
    }

    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { verifyToken } = await import('../services/authService.js')
    const payload = verifyToken(header.slice(7))
    const user = await findUserByEmail(payload.email)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await comparePassword(currentPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' })

    const existing = await findUserByEmail(newEmail)
    if (existing) return res.status(400).json({ error: 'Ese correo ya está registrado' })

    const { default: pool } = await import('../config/database.js')
    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [newEmail.toLowerCase(), user.id])

    const session = await buildSession({ ...user, email: newEmail.toLowerCase() })
    res.json({ data: { session }, error: null })
  } catch (err) {
    next(err)
  }
})

// PUT /api/auth/update-password
router.put('/update-password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' })
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    }

    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const { verifyToken, hashPassword } = await import('../services/authService.js')
    const payload = verifyToken(header.slice(7))
    const user = await findUserByEmail(payload.email)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const valid = await comparePassword(currentPassword, user.password_hash)
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' })

    const newHash = await hashPassword(newPassword)
    const { default: pool } = await import('../config/database.js')
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

export default router
