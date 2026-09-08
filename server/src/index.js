import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import Redis from 'ioredis'
import { setupRoomRoutes } from './routes/rooms.js'
import { setupAnimateRoute } from './routes/animate.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { setupWaterfallHandlers } from './socket/waterfallHandlers.js'
import { setupDatabase } from './db/index.js'

const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const REDIS_URL = process.env.REDIS_URL || null

// ── Fastify ───────────────────────────────────────────────────────────────────
const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, { origin: true, credentials: true })
await app.register(jwt, { secret: JWT_SECRET })

// ── Database ──────────────────────────────────────────────────────────────────
await setupDatabase()

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(app.server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
})

// ── Redis — khai báo ngoài if để dùng được ở setupSocketHandlers ──────────────
let redisClient = null

if (REDIS_URL) {
  try {
    const pub = new Redis(REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
    const sub = pub.duplicate()
    pub.on('error', (err) => console.warn('[Redis pub]', err.message))
    sub.on('error', (err) => console.warn('[Redis sub]', err.message))
    await Promise.all([pub.connect(), sub.connect()])
    io.adapter(createAdapter(pub, sub))
    app.decorate('redis', pub)
    redisClient = pub
    console.log('✅ Redis connected')
  } catch (err) {
    console.warn('⚠️  Redis unavailable:', err.message)
  }
} else {
  console.log('ℹ️  No REDIS_URL set')
}

// ── Auth middleware ───────────────────────────────────────────────────────────
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token
  if (token) {
    try {
      socket.user = app.jwt.verify(token)
      return next()
    } catch {
      return next(new Error('Invalid token'))
    }
  }
  // Allow unauthenticated connections — bridge registration and whiteboard
  // auth are handled per-event inside the socket handlers.
  next()
})

// ── Socket handlers ───────────────────────────────────────────────────────────
// Waterfall handlers registered first so bridge can authenticate before auth check
setupWaterfallHandlers(io)
setupSocketHandlers(io, redisClient)

// ── HTTP Routes ───────────────────────────────────────────────────────────────
app.get('/health', async () => ({
  status: 'ok',
  ts: Date.now(),
  // Chỉ trả boolean — không bao giờ lộ giá trị secret ra ngoài. Dùng để verify
  // biến môi trường đã tới được process sau mỗi lần deploy.
  waterfallBridgeConfigured: Boolean(process.env.WATERFALL_BRIDGE_SECRET),
}))
await setupRoomRoutes(app)
await setupAnimateRoute(app)

// ── Start ─────────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`🚀 Server running on port ${PORT}`)
