#!/usr/bin/env node
/**
 * Import exported Supabase data into the new PostgreSQL database.
 * Run AFTER migrate.js has created the schema.
 *
 * Usage: node server/src/db/import-data.js
 * Requires DATABASE_URL in server/.env
 */

import 'dotenv/config'
import pg from 'pg'
import { readFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'exported')

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

// Import order respects FK dependencies
const IMPORT_ORDER = [
  'negocios',
  'tipos_membresia',
  'tipos_lavado',
  'lavadores',
  'metodos_pago',
  'servicios_adicionales',
  'clientes',
  'lavadas',
  'transacciones',
  'tareas',
  'tareas_completadas',
  'pago_trabajadores',
  'reservas',
  'audit_log',
  'user_profiles',  // Last — needs negocios + users to exist
]

function readExported(table) {
  const filePath = join(DATA_DIR, `${table}.json`)
  if (!existsSync(filePath)) {
    return null
  }
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

async function importTable(client, table, rows) {
  if (!rows || rows.length === 0) return 0

  // Get column names from first row, excluding any that aren't in our schema
  const sampleRow = rows[0]
  const columns = Object.keys(sampleRow)

  let imported = 0
  for (const row of rows) {
    const values = columns.map(col => {
      const val = row[col]

      // Known PostgreSQL Array columns (should NOT be stringified)
      const ARRAY_COLUMNS = ['dias_semana', 'adicionales_incluidos']

      if (ARRAY_COLUMNS.includes(col)) {
        return val // Pass raw array to pg driver
      }

      // Convert objects/arrays to JSON strings for JSONB columns
      if (val !== null && typeof val === 'object') {
        return JSON.stringify(val)
      }
      return val
    })

    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const colNames = columns.map(c => `"${c}"`).join(', ')

    try {
      await client.query(
        `INSERT INTO "${table}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values
      )
      imported++
    } catch (err) {
      // Log but continue — some rows may have FK issues
      if (!err.message.includes('duplicate key')) {
        console.warn(`    Warning on ${table} row ${row.id}: ${err.message}`)
      }
    }
  }

  return imported
}

async function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`Error: No exported data found at ${DATA_DIR}`)
    console.error('Run the export script first: node server/src/db/export-supabase.js EMAIL PASSWORD')
    process.exit(1)
  }

  const client = await pool.connect()

  try {
    // Disable FK checks during import for speed
    await client.query('SET session_replication_role = replica')

    let totalImported = 0

    for (const table of IMPORT_ORDER) {
      process.stdout.write(`  Importing ${table}...`)
      const rows = readExported(table)

      if (!rows) {
        console.log(' (no export file, skipping)')
        continue
      }

      // Skip user_profiles — those will be created fresh when users register
      if (table === 'user_profiles') {
        console.log(` ${rows.length} rows (skipped — users re-register)`)
        continue
      }

      const count = await importTable(client, table, rows)
      console.log(` ${count}/${rows.length} rows`)
      totalImported += count
    }

    // Re-enable FK checks
    await client.query('SET session_replication_role = DEFAULT')

    console.log(`\nDone! Imported ${totalImported} total records.`)
    console.log('\nNext steps:')
    console.log('  1. Users need to re-register (Supabase auth cannot be exported)')
    console.log('  2. After first user registers, their profile will link to the existing negocio')
  } catch (err) {
    console.error('Fatal error:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
