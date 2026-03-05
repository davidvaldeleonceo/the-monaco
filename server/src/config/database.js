import pg from 'pg'
import env from './env.js'

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects.
// Without this, pg converts DATE to midnight UTC which shifts to the previous day
// when the frontend converts to America/Bogota (UTC-5).
pg.types.setTypeParser(1082, val => val)

const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('Unexpected pool error', err)
})

export default pool
