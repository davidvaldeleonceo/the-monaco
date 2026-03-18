import pool from '../config/database.js'

const SEED_DEFAULTS = {
  COP: {
    membresia: 50000,
    adicionales: [['Cera y Restaurador', 5000], ['Kit Completo', 10000]],
    metodos: ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'TRANSFERENCIA'],
  },
  MXN: {
    membresia: 500,
    adicionales: [['Cera y Restaurador', 50], ['Kit Completo', 100]],
    metodos: ['EFECTIVO', 'TRANSFERENCIA'],
  },
  USD: {
    membresia: 30,
    adicionales: [['Cera y Restaurador', 3], ['Kit Completo', 6]],
    metodos: ['EFECTIVO', 'TRANSFERENCIA', 'ZELLE'],
  },
  PEN: {
    membresia: 100,
    adicionales: [['Cera y Restaurador', 10], ['Kit Completo', 20]],
    metodos: ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'],
  },
  CLP: {
    membresia: 25000,
    adicionales: [['Cera y Restaurador', 2500], ['Kit Completo', 5000]],
    metodos: ['EFECTIVO', 'TRANSFERENCIA'],
  },
  ARS: {
    membresia: 15000,
    adicionales: [['Cera y Restaurador', 1500], ['Kit Completo', 3000]],
    metodos: ['EFECTIVO', 'MERCADOPAGO', 'TRANSFERENCIA'],
  },
  NIO: {
    membresia: 500,
    adicionales: [['Cera y Restaurador', 50], ['Kit Completo', 100]],
    metodos: ['EFECTIVO', 'TRANSFERENCIA'],
  },
}

/**
 * Seed default configuration for a new negocio.
 * Called after register_negocio / crear_negocio_y_perfil.
 */
export async function seedNegocio(negocioId, externalClient, moneda = 'COP') {
  // If an external client is provided, run queries on it (caller manages transaction)
  if (externalClient) {
    await _seedQueries(externalClient, negocioId, moneda)
    return
  }

  // Standalone mode: manage own transaction
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await _seedQueries(client, negocioId, moneda)
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    throw err
  } finally {
    client.release()
  }
}

async function _seedQueries(client, negocioId, moneda) {
  const defaults = SEED_DEFAULTS[moneda] || SEED_DEFAULTS.COP

  await client.query(`
    INSERT INTO tipos_membresia (nombre, precio, duracion_dias, activo, negocio_id)
    VALUES
      ('MENSUAL', $2, 1, true, $1)
    ON CONFLICT DO NOTHING
  `, [negocioId, defaults.membresia])

  // Build metodos VALUES dynamically
  const metodoValues = defaults.metodos.map((_, i) => `($${i + 2}, true, $1)`).join(', ')
  await client.query(
    `INSERT INTO metodos_pago (nombre, activo, negocio_id) VALUES ${metodoValues} ON CONFLICT DO NOTHING`,
    [negocioId, ...defaults.metodos]
  )

  // Build adicionales VALUES dynamically
  const adValues = defaults.adicionales.map((_, i) => `($${i * 2 + 2}, $${i * 2 + 3}, true, $1)`).join(', ')
  const adParams = defaults.adicionales.flatMap(([nombre, precio]) => [nombre, precio])
  await client.query(
    `INSERT INTO servicios_adicionales (nombre, precio, activo, negocio_id) VALUES ${adValues} ON CONFLICT DO NOTHING`,
    [negocioId, ...adParams]
  )
}

// CLI usage: node src/db/seed.js <negocio_id>
if (process.argv[2]) {
  seedNegocio(process.argv[2])
    .then(() => { console.log('Seed completed'); process.exit(0) })
    .catch(() => process.exit(1))
}
