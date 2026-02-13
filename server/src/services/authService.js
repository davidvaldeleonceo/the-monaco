import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import env from '../config/env.js'
import pool from '../config/database.js'

const SALT_ROUNDS = 10
const JWT_EXPIRES_IN = '7d'

export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: JWT_EXPIRES_IN })
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret)
}

export async function createUser(email, password) {
  const hash = await hashPassword(password)
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
    [email.toLowerCase(), hash]
  )
  return rows[0]
}

export async function findUserByEmail(email) {
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  )
  return rows[0] || null
}

export async function buildSession(user) {
  // Fetch negocio_id from user_profiles
  const { rows } = await pool.query(
    'SELECT negocio_id FROM user_profiles WHERE id = $1',
    [user.id]
  )
  const negocioId = rows[0]?.negocio_id || null

  const token = signToken({
    sub: user.id,
    email: user.email,
    negocio_id: negocioId,
  })

  return {
    access_token: token,
    user: {
      id: user.id,
      email: user.email,
    },
  }
}
