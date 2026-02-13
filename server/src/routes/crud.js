import { Router } from 'express'
import pool from '../config/database.js'
import {
  isAllowedTable,
  buildSelectQuery,
  buildInsertQuery,
  buildUpdateQuery,
  buildDeleteQuery,
} from '../services/queryBuilder.js'
import { parseSelect } from '../services/joinResolver.js'

const router = Router()

/**
 * After INSERT/UPDATE we may need to re-fetch with joins
 * so the client gets the same shape as a SELECT.
 */
async function refetchWithJoins(table, id, selectStr, negocioId, isScoped) {
  if (!selectStr || !selectStr.includes(':')) {
    return null // no joins needed
  }

  const { columns, joins } = parseSelect(table, selectStr)
  const values = [id]
  let paramIdx = 2

  let sql = `SELECT ${columns.join(', ')} FROM "${table}" ${joins.join(' ')} WHERE "${table}".id = $1`

  if (isScoped && negocioId) {
    sql += ` AND "${table}".negocio_id = $${paramIdx++}`
    values.push(negocioId)
  }

  const { rows } = await pool.query(sql, values)
  return rows[0] || null
}

// GET /api/:table
router.get('/:table', async (req, res, next) => {
  try {
    const { table } = req.params
    if (!isAllowedTable(table)) {
      return res.status(404).json({ error: `Table "${table}" not found` })
    }

    const { sql, values } = buildSelectQuery(
      table, req.query, req.negocioId, req.isScoped
    )

    const { rows } = await pool.query(sql, values)

    // If ?single=true, return single object
    if (req.query.single === 'true') {
      return res.json({ data: rows[0] || null, error: null })
    }

    res.json({ data: rows, error: null })
  } catch (err) {
    next(err)
  }
})

// POST /api/:table
router.post('/:table', async (req, res, next) => {
  try {
    const { table } = req.params
    if (!isAllowedTable(table)) {
      return res.status(404).json({ error: `Table "${table}" not found` })
    }

    const selectStr = req.query.select || req.headers['x-select'] || ''
    const body = req.body

    // Handle bulk inserts (array with multiple items)
    const items = Array.isArray(body) ? body : [body]

    const allResults = []
    for (const item of items) {
      const { sql, values } = buildInsertQuery(
        table, item, req.negocioId, req.isScoped, selectStr
      )

      const { rows } = await pool.query(sql, values)
      let result = rows[0]

      // Re-fetch with joins if select string has them
      if (selectStr && selectStr.includes(':') && result?.id) {
        const joined = await refetchWithJoins(table, result.id, selectStr, req.negocioId, req.isScoped)
        if (joined) result = joined
      }

      allResults.push(result)
    }

    // Emit realtime event for last insert
    if (req.io && allResults.length > 0) {
      req.io.to(`negocio:${req.negocioId}`).emit(`db:${table}`, {
        event: 'INSERT',
        table,
        record: allResults[allResults.length - 1],
      })
    }

    if (req.query.single === 'true') {
      return res.status(201).json({ data: allResults[0] || null, error: null })
    }

    // Return single result for single insert, array for bulk
    const data = items.length === 1 ? allResults[0] : allResults
    res.status(201).json({ data, error: null })
  } catch (err) {
    next(err)
  }
})

// PATCH /api/:table
router.patch('/:table', async (req, res, next) => {
  try {
    const { table } = req.params
    if (!isAllowedTable(table)) {
      return res.status(404).json({ error: `Table "${table}" not found` })
    }

    const filters = { ...req.query }
    delete filters.select
    delete filters.single

    const selectStr = req.query.select || req.headers['x-select'] || ''

    const { sql, values } = buildUpdateQuery(
      table, req.body, filters, req.negocioId, req.isScoped
    )

    const { rows } = await pool.query(sql, values)
    let result = rows[0]

    // Re-fetch with joins if needed
    if (selectStr && selectStr.includes(':') && result?.id) {
      const joined = await refetchWithJoins(table, result.id, selectStr, req.negocioId, req.isScoped)
      if (joined) result = joined
    }

    // Emit realtime event
    if (req.io) {
      req.io.to(`negocio:${req.negocioId}`).emit(`db:${table}`, {
        event: 'UPDATE',
        table,
        record: result,
      })
    }

    if (req.query.single === 'true') {
      return res.json({ data: result, error: null })
    }

    res.json({ data: rows, error: null })
  } catch (err) {
    next(err)
  }
})

// DELETE /api/:table
router.delete('/:table', async (req, res, next) => {
  try {
    const { table } = req.params
    if (!isAllowedTable(table)) {
      return res.status(404).json({ error: `Table "${table}" not found` })
    }

    const filters = { ...req.query }
    delete filters.select
    delete filters.single

    const { sql, values } = buildDeleteQuery(
      table, filters, req.negocioId, req.isScoped
    )

    const { rows } = await pool.query(sql, values)

    // Emit realtime event
    if (req.io && rows[0]) {
      req.io.to(`negocio:${req.negocioId}`).emit(`db:${table}`, {
        event: 'DELETE',
        table,
        record: rows[0],
      })
    }

    res.json({ data: rows, error: null })
  } catch (err) {
    next(err)
  }
})

export default router
