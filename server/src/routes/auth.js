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
