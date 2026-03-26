import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { setupRoomRoutes, setupAnimateRoute } from './routes/rooms.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { setupDatabase } from './db/index.js'

const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const REDIS_URL = process.env.REDIS_URL || null

// ── Fastify ───────────────────────────────────────────────────────────────────
const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: true,
  credentials: true,
})
await app.register(jwt, { secret: JWT_SECRET })

// ── Database ──────────────────────────────────────────────────────────────────
await setupDatabase()

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(app.server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
})

// ── Redis (tuỳ chọn — nếu có REDIS_URL thì dùng adapter để scale) ─────────────
if (REDIS_URL) {
  try {
    const pubClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    const subClient = pubClient.duplicate()

    pubClient.on('error', (err) => console.warn('[Redis pub] error:', err.message))
    subClient.on('error', (err) => console.warn('[Redis sub] error:', err.message))

    await Promise.all([pubClient.connect(), subClient.connect()])
    io.adapter(createAdapter(pubClient, subClient))
    app.decorate('redis', pubClient)
    console.log('✅ Redis connected')
  } catch (err) {
    console.warn('⚠️  Redis unavailable, running without pub/sub adapter:', err.message)
  }
} else {
  console.log('ℹ️  No REDIS_URL set, skipping Redis adapter (single instance mode)')
}

// Middleware xác thực token trước khi connect
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  if (!token) return next(new Error('Authentication required'))
  try {
    socket.user = app.jwt.verify(token)
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

setupSocketHandlers(io)

// ── HTTP Routes ───────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }))
await setupRoomRoutes(app)
await setupAnimateRoute(app)

// ── Start ─────────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`🚀 Server running on port ${PORT}`)
