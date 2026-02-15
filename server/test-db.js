import pg from 'pg'
const pool = new pg.Pool({
    connectionString: 'postgresql://MonacoPro:M0n4c0*moto@localhost:5433/MonacoProDB',
    connectionTimeoutMillis: 5000,
})

async function test() {
    try {
        console.log('Testing connection...')
        const res = await pool.query('SELECT current_user, current_database()')
        console.log('Connected! User:', res.rows[0].current_user, 'DB:', res.rows[0].current_database)
    } catch (e) {
        console.error('Connection failed:', e.message)
    } finally {
        await pool.end()
    }
}
test()
