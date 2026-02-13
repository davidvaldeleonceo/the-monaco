export default function errorHandler(err, req, res, _next) {
  console.error('Unhandled error:', err)

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

  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  })
}
