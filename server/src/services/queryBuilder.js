/**
 * Query Builder
 *
 * Translates PostgREST-style query parameters into SQL.
 * Supports: eq, neq, gt, gte, lt, lte, like, ilike, is, in, or
 * Also: order, limit, offset, select (with joins via joinResolver)
 */

import { parseSelect } from './joinResolver.js'

const COLUMN_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export function validateColumnName(col) {
  if (!COLUMN_NAME_REGEX.test(col)) {
    throw new Error(`Invalid column name: "${col}"`)
  }
  return col
}

const ALLOWED_TABLES = new Set([
  'users', 'negocios', 'user_profiles', 'clientes', 'lavadas',
  'tipos_lavado', 'tipos_membresia', 'lavadores', 'metodos_pago',
  'servicios_adicionales', 'transacciones', 'productos', 'tareas',
  'tareas_completadas', 'pago_trabajadores', 'reservas', 'audit_log',
  'pagos_suscripcion', 'plantillas_mensaje', 'mensajes_enviados',
  'categorias_transaccion',
])

export function isAllowedTable(table) {
  return ALLOWED_TABLES.has(table)
}

/**
 * Parse filter operators from query params.
 * Format: column=op.value  (e.g. activo=eq.true, fecha=gte.2024-01-01)
 */
function parseFilters(query, table, startIdx = 1, { strict = false } = {}) {
  const filters = []
  const values = []
  let paramIdx = startIdx

  for (const [key, rawValue] of Object.entries(query)) {
    // Skip meta params
    if (['select', 'order', 'limit', 'offset', 'or', 'single'].includes(key)) continue

    validateColumnName(key)

    // Handle array values (multiple filters on same column, e.g. fecha=gte.X&fecha=lt.Y)
    const rawValues = Array.isArray(rawValue) ? rawValue : [rawValue]

    for (const rv of rawValues) {
      const val = String(rv)
      const dotIdx = val.indexOf('.')
      if (dotIdx === -1) {
        if (strict) throw new Error(`Filter value missing operator for column "${key}": ${val}`)
        continue
      }

      const op = val.substring(0, dotIdx)
      const operand = val.substring(dotIdx + 1)

      switch (op) {
        case 'eq':
          if (operand === 'true') {
            filters.push(`"${table}"."${key}" = true`)
          } else if (operand === 'false') {
            filters.push(`"${table}"."${key}" = false`)
          } else if (operand === 'null') {
            filters.push(`"${table}"."${key}" IS NULL`)
          } else {
            filters.push(`"${table}"."${key}" = $${paramIdx++}`)
            values.push(operand)
          }
          break
        case 'neq':
          filters.push(`"${table}"."${key}" != $${paramIdx++}`)
          values.push(operand)
          break
        case 'gt':
          filters.push(`"${table}"."${key}" > $${paramIdx++}`)
          values.push(operand)
          break
        case 'gte':
          filters.push(`"${table}"."${key}" >= $${paramIdx++}`)
          values.push(operand)
          break
        case 'lt':
          filters.push(`"${table}"."${key}" < $${paramIdx++}`)
          values.push(operand)
          break
        case 'lte':
          filters.push(`"${table}"."${key}" <= $${paramIdx++}`)
          values.push(operand)
          break
        case 'like':
          filters.push(`"${table}"."${key}" LIKE $${paramIdx++}`)
          values.push(operand)
          break
        case 'ilike':
          filters.push(`"${table}"."${key}" ILIKE $${paramIdx++}`)
          values.push(operand)
          break
        case 'is':
          if (operand === 'null') {
            filters.push(`"${table}"."${key}" IS NULL`)
          } else if (operand === 'true') {
            filters.push(`"${table}"."${key}" IS TRUE`)
          } else if (operand === 'false') {
            filters.push(`"${table}"."${key}" IS FALSE`)
          } else if (strict) {
            throw new Error(`Unsupported "is" operand for column "${key}": ${operand}`)
          }
          break
        case 'in': {
          // Format: in.(val1,val2,val3)
          const inValues = operand.replace(/^\(/, '').replace(/\)$/, '').split(',')
          if (inValues.length === 0 || (inValues.length === 1 && inValues[0] === '')) {
            // Empty IN list — match nothing instead of producing invalid SQL
            filters.push('FALSE')
            break
          }
          const placeholders = inValues.map(() => `$${paramIdx++}`)
          filters.push(`"${table}"."${key}" IN (${placeholders.join(',')})`)
          values.push(...inValues)
          break
        }
        default:
          if (strict) {
            throw new Error(`Unsupported filter operator "${op}" for column "${key}"`)
          }
          // Non-strict: silently skip unknown ops (legacy permissive behavior for SELECT)
          break
      }
    }
  }

  return { filters, values, paramIdx }
}

/**
 * Parse "or" parameter.
 * Format: or=(cond1,cond2)  e.g. or=(anulado.is.null,anulado.eq.false)
 */
function parseOr(orParam, table, startIdx) {
  if (!orParam) return { clause: '', values: [], nextIdx: startIdx }

  // Remove wrapping parens if present
  let inner = orParam
  if (inner.startsWith('(') && inner.endsWith(')')) {
    inner = inner.slice(1, -1)
  }

  const parts = []
  const values = []
  let idx = startIdx

  // Split on commas that aren't inside parens
  const conditions = inner.split(',')

  for (const cond of conditions) {
    // Format: column.op.value
    const firstDot = cond.indexOf('.')
    if (firstDot === -1) continue
    const column = cond.substring(0, firstDot)
    validateColumnName(column)

    const rest = cond.substring(firstDot + 1)
    const secondDot = rest.indexOf('.')
    if (secondDot === -1) continue
    const op = rest.substring(0, secondDot)
    const operand = rest.substring(secondDot + 1)

    switch (op) {
      case 'eq':
        if (operand === 'true') parts.push(`"${table}"."${column}" = true`)
        else if (operand === 'false') parts.push(`"${table}"."${column}" = false`)
        else {
          parts.push(`"${table}"."${column}" = $${idx++}`)
          values.push(operand)
        }
        break
      case 'is':
        if (operand === 'null') parts.push(`"${table}"."${column}" IS NULL`)
        else if (operand === 'true') parts.push(`"${table}"."${column}" IS TRUE`)
        else if (operand === 'false') parts.push(`"${table}"."${column}" IS FALSE`)
        break
      case 'gte':
        parts.push(`"${table}"."${column}" >= $${idx++}`)
        values.push(operand)
        break
      case 'lte':
        parts.push(`"${table}"."${column}" <= $${idx++}`)
        values.push(operand)
        break
      case 'lt':
        parts.push(`"${table}"."${column}" < $${idx++}`)
        values.push(operand)
        break
      case 'gt':
        parts.push(`"${table}"."${column}" > $${idx++}`)
        values.push(operand)
        break
    }
  }

  const clause = parts.length > 0 ? `(${parts.join(' OR ')})` : ''
  return { clause, values, nextIdx: idx }
}

/**
 * Build a SELECT query from request parameters.
 */
export function buildSelectQuery(table, query, negocioId, isScoped) {
  const selectStr = query.select || '*'
  const { columns, joins } = parseSelect(table, selectStr)

  const { filters, values, paramIdx } = parseFilters(query, table)

  // Add tenant scope
  if (isScoped && negocioId) {
    filters.push(`"${table}"."negocio_id" = $${paramIdx}`)
    values.push(negocioId)
  }

  // Parse OR filter
  const orResult = parseOr(query.or, table, values.length + 1)
  if (orResult.clause) {
    filters.push(orResult.clause)
    values.push(...orResult.values)
  }

  let sql = `SELECT ${columns.join(', ')} FROM "${table}"`

  if (joins.length > 0) {
    sql += ' ' + joins.join(' ')
  }

  if (filters.length > 0) {
    sql += ' WHERE ' + filters.join(' AND ')
  }

  // Order
  if (query.order) {
    const orders = query.order.split(',').map(o => {
      const [col, dir] = o.split('.')
      validateColumnName(col)
      return `"${table}"."${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`
    })
    sql += ' ORDER BY ' + orders.join(', ')
  }

  // Limit
  if (query.limit) {
    sql += ` LIMIT ${parseInt(query.limit, 10)}`
  }

  // Offset
  if (query.offset) {
    sql += ` OFFSET ${parseInt(query.offset, 10)}`
  }

  return { sql, values }
}

/**
 * Build an INSERT query. Returns the full row with optional select/joins.
 */
export function buildInsertQuery(table, body, negocioId, isScoped, selectStr) {
  const raw = Array.isArray(body) ? body[0] : body

  // Strip undefined values and convert empty-string FK columns to null
  const data = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue
    data[k] = (v === '' && k.endsWith('_id')) ? null : v
  }

  // Add negocio_id if scoped and not already present
  if (isScoped && negocioId && !data.negocio_id) {
    data.negocio_id = negocioId
  }

  const keys = Object.keys(data)
  // Simple validation for keys to ensure they are valid columns
  keys.forEach(k => validateColumnName(k))

  const values = Object.values(data).map(v =>
    v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  )
  const placeholders = keys.map((_, i) => `$${i + 1}`)

  let sql = `INSERT INTO "${table}" (${keys.map(k => `"${k}"`).join(', ')})
             VALUES (${placeholders.join(', ')})
             RETURNING *`

  return { sql, values }
}

/**
 * Build an UPDATE query.
 * Uses strict filter parsing so unknown operators throw instead of silently
 * widening the WHERE clause (which would touch unintended rows).
 */
export function buildUpdateQuery(table, body, filters, negocioId, isScoped) {
  // Strip undefined values and convert empty strings to null for FK columns
  const cleanBody = {}
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined) continue
    cleanBody[k] = (v === '' && k.endsWith('_id')) ? null : v
  }

  const keys = Object.keys(cleanBody)
  if (keys.length === 0) {
    throw new Error('No valid columns to update')
  }

  const values = Object.values(cleanBody).map(v =>
    v !== null && typeof v === 'object' ? JSON.stringify(v) : v
  )

  keys.forEach(k => validateColumnName(k))
  const setClauses = keys.map((k, i) => `"${k}" = $${i + 1}`)
  const setParamCount = keys.length

  const { filters: whereClauses, values: filterValues, paramIdx: nextIdx } =
    parseFilters(filters, table, setParamCount + 1, { strict: true })
  values.push(...filterValues)
  let paramIdx = nextIdx

  if (isScoped && negocioId) {
    whereClauses.push(`"${table}"."negocio_id" = $${paramIdx++}`)
    values.push(negocioId)
  }

  if (whereClauses.length === 0) {
    throw new Error('UPDATE requires at least one WHERE filter')
  }

  let sql = `UPDATE "${table}" SET ${setClauses.join(', ')}`
  sql += ' WHERE ' + whereClauses.join(' AND ')
  sql += ' RETURNING *'

  return { sql, values }
}

/**
 * Build a DELETE query.
 * Uses strict filter parsing so unknown operators throw instead of silently
 * widening the WHERE clause (which would delete unintended rows).
 */
export function buildDeleteQuery(table, filters, negocioId, isScoped) {
  const { filters: whereClauses, values, paramIdx: nextIdx } =
    parseFilters(filters, table, 1, { strict: true })
  let paramIdx = nextIdx

  if (isScoped && negocioId) {
    whereClauses.push(`"${table}"."negocio_id" = $${paramIdx++}`)
    values.push(negocioId)
  }

  if (whereClauses.length === 0) {
    throw new Error('DELETE requires at least one WHERE filter')
  }

  let sql = `DELETE FROM "${table}"`
  sql += ' WHERE ' + whereClauses.join(' AND ')
  sql += ' RETURNING *'

  return { sql, values }
}
