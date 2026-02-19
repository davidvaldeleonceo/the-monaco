import { createServer } from 'http'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import cors from 'cors'
import env from './config/env.js'
import pool from './config/database.js'
import auth from './middleware/auth.js'
import tenantScope from './middleware/tenantScope.js'
import errorHandler from './middleware/errorHandler.js'
import authRoutes from './routes/auth.js'
import rpcRoutes from './routes/rpc.js'
import crudRoutes from './routes/crud.js'
import wompiRoutes from './routes/wompi.js'
import planLimits from './middleware/planLimits.js'
import { initRealtime } from './services/realtimeService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = express()
const httpServer = createServer(app)

// Socket.io
const io = initRealtime(httpServer, env.corsOrigin)

// Middleware
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '10mb' }))

// Inject io into requests for realtime events
app.use((req, _res, next) => {
  req.io = io
  next()
})

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  } catch {
    res.status(500).json({ status: 'error', message: 'Database connection failed' })
  }
})

// Auth routes (no auth middleware)
app.use('/api/auth', authRoutes)

// RPC routes (auth required)
app.use('/api/rpc', auth, rpcRoutes)

// Wompi routes (auth applied per-route inside, webhook is public)
app.use('/api/wompi', wompiRoutes)

// CRUD routes (auth + tenant scope + plan limits)
app.use('/api', auth, tenantScope, planLimits, crudRoutes)

// Serve frontend in production
if (env.nodeEnv === 'production') {
  const distPath = join(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'))
  })
}

// Error handler
app.use(errorHandler)

// Start
httpServer.listen(env.port, () => {
  console.log(`Monaco API running on port ${env.port} (${env.nodeEnv})`)
})
