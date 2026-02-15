export default function errorHandler(err, req, res, _next) {
  console.error(`[${req.method} ${req.originalUrl}] Unhandled error:`, err.message)
  if (err.stack) console.error(err.stack)
  if (req.body && Object.keys(req.body).length > 0) {
    console.error('Request body:', JSON.stringify(req.body).slice(0, 500))
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({
      error: 'Duplicate entry',
      message: err.detail || 'A record with this value already exists',
    })
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(409).json({
      error: 'Foreign key violation',
      message: err.detail || 'Referenced record does not exist or record is still referenced',
    })
  }

  // PostgreSQL invalid input syntax (e.g. bad UUID, bad type)
  if (err.code === '22P02') {
    return res.status(400).json({
      error: 'Invalid input',
      message: err.message,
    })
  }

  // PostgreSQL not-null violation
  if (err.code === '23502') {
    return res.status(400).json({
      error: 'Missing required field',
      message: err.detail || err.message,
    })
  }

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
}
