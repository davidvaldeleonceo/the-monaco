#!/usr/bin/env node
/**
 * Export all data from Supabase into JSON files.
 * Run: node server/src/db/export-supabase.js
 *
 * Requires no dependencies beyond Node.js built-in fetch (Node 18+).
 * Exports each table as a JSON file into server/src/db/exported/
 */

import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, 'exported')

// Supabase config
const SUPABASE_URL = 'https://pwfmtihfnaumywrfwbnl.supabase.co'
const SERVICE_ROLE_KEY = process.argv[2]
if (!SERVICE_ROLE_KEY) {
  console.error('Usage: node export-supabase.js SERVICE_ROLE_KEY')
  process.exit(1)
}

// Tables to export (order matters for FK dependencies)
const TABLES = [
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
]

// service_role key bypasses RLS — no login needed
async function supabaseFetch(path, options = {}) {
  const headers = {
    'apikey': SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...options.headers,
  }

  const res = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function exportTable(table) {
  // Supabase REST API with pagination (max 1000 per page)
  let allRows = []
  let offset = 0
  const pageSize = 1000

  while (true) {
    const rows = await supabaseFetch(
      `/rest/v1/${table}?select=*&offset=${offset}&limit=${pageSize}`,
      {
        headers: {
          'Prefer': 'count=exact',
          'Range': `${offset}-${offset + pageSize - 1}`,
        },
      }
    )

    allRows = allRows.concat(rows)

    if (rows.length < pageSize) break
    offset += pageSize
  }

  return allRows
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })

  console.log('Using service_role key (bypasses RLS)...\n')

  let totalRecords = 0

  for (const table of TABLES) {
    process.stdout.write(`  Exporting ${table}...`)
    try {
      const rows = await exportTable(table)
      const filePath = join(OUT_DIR, `${table}.json`)
      writeFileSync(filePath, JSON.stringify(rows, null, 2))
      console.log(` ${rows.length} rows`)
      totalRecords += rows.length
    } catch (err) {
      console.log(` ERROR: ${err.message}`)
    }
  }

  // Also export user_profiles (we need it for the user mapping)
  process.stdout.write('  Exporting user_profiles...')
  try {
    const profiles = await exportTable('user_profiles')
    writeFileSync(join(OUT_DIR, 'user_profiles.json'), JSON.stringify(profiles, null, 2))
    console.log(` ${profiles.length} rows`)
    totalRecords += profiles.length
  } catch (err) {
    console.log(` ERROR: ${err.message}`)
  }

  console.log(`\nDone! Exported ${totalRecords} total records to ${OUT_DIR}/`)
  console.log('\nNote: Users (auth.users) cannot be exported via REST API.')
  console.log('Users will need to re-register on the new system.')
  console.log('All business data (clients, services, etc.) has been preserved.')
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
