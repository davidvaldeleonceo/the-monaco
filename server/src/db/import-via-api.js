#!/usr/bin/env node
/**
 * Import exported Supabase data via the app's API.
 * This avoids needing direct database access.
 *
 * Usage: node import-via-api.js API_URL EMAIL PASSWORD [OLD_NEGOCIO_ID]
 * Example: node import-via-api.js http://monaco-pro-frontend-iliecc-da0042-187-77-15-68.traefik.me principal@themonaco.com.co password123
 */

import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'exported')

const API_URL = process.argv[2]
const EMAIL = process.argv[3]
const PASSWORD = process.argv[4]
const OLD_NEGOCIO_ID = process.argv[5] || 'daa4dc6e-f3bd-4e2c-b4c5-a917fd292b35'

if (!API_URL || !EMAIL || !PASSWORD) {
  console.error('Usage: node import-via-api.js API_URL EMAIL PASSWORD [OLD_NEGOCIO_ID]')
  process.exit(1)
}

let token = null

async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers })
  const data = await res.json()
  if (!res.ok && !data.error) data.error = `HTTP ${res.status}`
  return data
}

async function login() {
  console.log(`Logging in as ${EMAIL}...`)
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (result.error) {
    console.error('Login failed:', result.error)
    process.exit(1)
  }
  token = result.data.session.access_token
  console.log('Logged in successfully.\n')
}

function readExported(table) {
  const filePath = join(DATA_DIR, `${table}.json`)
  if (!existsSync(filePath)) return []
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function filterByNegocio(rows) {
  return rows.filter(r => r.negocio_id === OLD_NEGOCIO_ID)
}

// Build ID mapping: old UUID → new UUID
const idMaps = {}

async function importTable(table, rows, { stripNegocioId = true, fkMappings = {} } = {}) {
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`)
    return
  }

  idMaps[table] = {}
  let imported = 0
  let errors = 0

  for (const row of rows) {
    const oldId = row.id
    const record = { ...row }

    // Remove id so the DB generates a new one
    delete record.id
    // Remove negocio_id — the server adds it automatically via tenant scope
    if (stripNegocioId) delete record.negocio_id
    // Remove created_at so it gets fresh timestamps
    delete record.created_at

    // Convert JSON arrays to PostgreSQL array literals for array columns (UUID[], INTEGER[])
    for (const arrCol of ['adicionales_incluidos', 'dias_semana']) {
      if (record[arrCol] !== undefined && Array.isArray(record[arrCol])) {
        record[arrCol] = `{${record[arrCol].join(',')}}`
      }
    }

    // Remap foreign keys using previous imports' ID maps
    for (const [fkCol, fkTable] of Object.entries(fkMappings)) {
      if (record[fkCol] && idMaps[fkTable]?.[record[fkCol]]) {
        record[fkCol] = idMaps[fkTable][record[fkCol]]
      } else if (record[fkCol] && idMaps[fkTable]) {
        // FK references a row we didn't import — set to null
        record[fkCol] = null
      }
    }

    try {
      const result = await apiFetch(`/api/${table}?single=true`, {
        method: 'POST',
        body: JSON.stringify(record),
      })

      if (result.error) {
        errors++
        if (errors <= 3) console.warn(`    Error on ${table}: ${result.error.message || result.error}`)
      } else {
        const newId = result.data?.id
        if (oldId && newId) idMaps[table][oldId] = newId
        imported++
      }
    } catch (err) {
      errors++
      if (errors <= 3) console.warn(`    Error on ${table}: ${err.message}`)
    }
  }

  console.log(`  ${table}: ${imported}/${rows.length} imported${errors > 0 ? ` (${errors} errors)` : ''}`)
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error('No exported data found. Run export-supabase.js first.')
    process.exit(1)
  }

  await login()

  console.log(`Importing data from negocio ${OLD_NEGOCIO_ID}...\n`)

  // 1. Config tables (no FK dependencies)
  await importTable('tipos_membresia', filterByNegocio(readExported('tipos_membresia')))
  await importTable('tipos_lavado', filterByNegocio(readExported('tipos_lavado')))
  await importTable('lavadores', filterByNegocio(readExported('lavadores')))
  await importTable('metodos_pago', filterByNegocio(readExported('metodos_pago')))
  await importTable('servicios_adicionales', filterByNegocio(readExported('servicios_adicionales')))

  // 2. Clients (depends on tipos_membresia)
  await importTable('clientes', filterByNegocio(readExported('clientes')), {
    fkMappings: { membresia_id: 'tipos_membresia' },
  })

  // 3. Lavadas (depends on clientes, tipos_lavado, lavadores, metodos_pago)
  await importTable('lavadas', filterByNegocio(readExported('lavadas')), {
    fkMappings: {
      cliente_id: 'clientes',
      tipo_lavado_id: 'tipos_lavado',
      tipo_membresia_id: 'tipos_membresia',
      lavador_id: 'lavadores',
      metodo_pago_id: 'metodos_pago',
    },
  })

  // 4. Transactions (depends on metodos_pago)
  await importTable('transacciones', filterByNegocio(readExported('transacciones')), {
    fkMappings: { metodo_pago_id: 'metodos_pago' },
  })

  // 5. Tareas
  await importTable('tareas', filterByNegocio(readExported('tareas')))

  // 6. Tareas completadas (depends on tareas, lavadores)
  await importTable('tareas_completadas', filterByNegocio(readExported('tareas_completadas')), {
    fkMappings: {
      tarea_id: 'tareas',
      lavador_id: 'lavadores',
    },
  })

  // 7. Pago trabajadores (depends on lavadores, metodos_pago)
  await importTable('pago_trabajadores', filterByNegocio(readExported('pago_trabajadores')), {
    fkMappings: {
      lavador_id: 'lavadores',
      metodo_pago_id: 'metodos_pago',
    },
  })

  console.log('\nImport complete!')
  console.log('Refresh the app to see your data.')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
