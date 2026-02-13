import pool from '../config/database.js'

/**
 * Seed default configuration for a new negocio.
 * Called after register_negocio / crear_negocio_y_perfil.
 */
export async function seedNegocio(negocioId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Default tipos de membresia
    await client.query(`
      INSERT INTO tipos_membresia (nombre, precio, duracion_dias, activo, negocio_id)
      VALUES
        ('SIN MEMBRESIA', 0, 0, true, $1),
        ('MENSUAL', 50000, 1, true, $1),
        ('TRIMESTRAL', 120000, 3, true, $1)
      ON CONFLICT DO NOTHING
    `, [negocioId])

    // Default tipos de lavado
    await client.query(`
      INSERT INTO tipos_lavado (nombre, precio, activo, negocio_id)
      VALUES
        ('SIN MEMBRESIA', 15000, true, $1),
        ('MEMBRESIA', 0, true, $1)
      ON CONFLICT DO NOTHING
    `, [negocioId])

    // Default metodos de pago
    await client.query(`
      INSERT INTO metodos_pago (nombre, activo, negocio_id)
      VALUES
        ('EFECTIVO', true, $1),
        ('NEQUI', true, $1),
        ('DAVIPLATA', true, $1),
        ('TRANSFERENCIA', true, $1)
      ON CONFLICT DO NOTHING
    `, [negocioId])

    // Default servicios adicionales
    await client.query(`
      INSERT INTO servicios_adicionales (nombre, precio, activo, negocio_id)
      VALUES
        ('Cera y Restaurador', 5000, true, $1),
        ('Kit Completo', 10000, true, $1)
      ON CONFLICT DO NOTHING
    `, [negocioId])

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    throw err
  } finally {
    client.release()
  }
}

// CLI usage: node src/db/seed.js <negocio_id>
if (process.argv[2]) {
  seedNegocio(process.argv[2])
    .then(() => { console.log('Seed completed'); process.exit(0) })
    .catch(() => process.exit(1))
}
