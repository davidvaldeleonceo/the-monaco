import { Server } from 'socket.io'
import { verifyToken } from './authService.js'

/**
 * Initialize Socket.io for realtime updates.
 *
 * Clients connect with JWT, join room "negocio:{id}".
 * Server emits "db:lavadas", "db:reservas" etc after CRUD operations.
 * DataContext only needs the event trigger (no payload needed for refreshes).
 */
export function initRealtime(httpServer, corsOrigin) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const payload = verifyToken(token)
      socket.user = {
        id: payload.sub,
        email: payload.email,
        negocio_id: payload.negocio_id,
      }
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const negocioId = socket.user.negocio_id
    if (negocioId) {
      socket.join(`negocio:${negocioId}`)
    }

    socket.on('disconnect', () => {
      // cleanup handled by socket.io
    })
  })

  return io
}
