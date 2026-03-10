import 'dotenv/config'
import pg from 'pg'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Missing DATABASE_URL environment variable')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5000 })

try {
    console.log('Testing connection...')
    const res = await pool.query('SELECT current_user, current_database()')
    console.log('Connected! User:', res.rows[0].current_user, 'DB:', res.rows[0].current_database)
} catch (e) {
    console.error('Connection failed:', e.message)
} finally {
    await pool.end()
}
