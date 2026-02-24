import pool from '../config/database.js'

/**
 * Seed default configuration for a new negocio.
 * Called after register_negocio / crear_negocio_y_perfil.
 */
export async function seedNegocio(negocioId, externalClient) {
  // If an external client is provided, run queries on it (caller manages transaction)
  if (externalClient) {
    await _seedQueries(externalClient, negocioId)
    return
  }

  // Standalone mode: manage own transaction
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await _seedQueries(client, negocioId)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    throw err
  } finally {
    client.release()
  }
}

async function _seedQueries(client, negocioId) {
  await client.query(`
    INSERT INTO tipos_membresia (nombre, precio, duracion_dias, activo, negocio_id)
    VALUES
      ('MENSUAL', 50000, 1, true, $1)
    ON CONFLICT DO NOTHING
  `, [negocioId])

  await client.query(`
    INSERT INTO metodos_pago (nombre, activo, negocio_id)
    VALUES
      ('EFECTIVO', true, $1),
      ('NEQUI', true, $1),
      ('DAVIPLATA', true, $1),
      ('TRANSFERENCIA', true, $1)
    ON CONFLICT DO NOTHING
  `, [negocioId])

  await client.query(`
    INSERT INTO servicios_adicionales (nombre, precio, activo, negocio_id)
    VALUES
      ('Cera y Restaurador', 5000, true, $1),
      ('Kit Completo', 10000, true, $1)
    ON CONFLICT DO NOTHING
  `, [negocioId])
}

// CLI usage: node src/db/seed.js <negocio_id>
if (process.argv[2]) {
  seedNegocio(process.argv[2])
    .then(() => { console.log('Seed completed'); process.exit(0) })
    .catch(() => process.exit(1))
}
