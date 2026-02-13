import { verifyToken } from '../services/authService.js'

export default function auth(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    req.user = {
      id: payload.sub,
      email: payload.email,
      negocio_id: payload.negocio_id,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}
