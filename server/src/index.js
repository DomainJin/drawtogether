import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { createClient } from 'ioredis'
import { setupRoomRoutes } from './routes/rooms.js'
import { setupSocketHandlers } from './socket/handlers.js'
import { setupDatabase } from './db/index.js'

const PORT = process.env.PORT || 3001
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// ── Fastify ──────────────────────────────────────────────────────────────────
const app = Fastify({ logger: { level: 'info' } })

await app.register(cors, {
  origin: CLIENT_URL,
  credentials: true,
})
await app.register(jwt, { secret: JWT_SECRET })

// ── Database ──────────────────────────────────────────────────────────────────
await setupDatabase()

// ── Redis ─────────────────────────────────────────────────────────────────────
const pubClient = createClient(REDIS_URL)
const subClient = pubClient.duplicate()
await Promise.all([pubClient.connect(), subClient.connect()])
app.decorate('redis', pubClient)

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(app.server, {
  cors: { origin: CLIENT_URL, methods: ['GET', 'POST'] },
  transports: ['websocket', 'polling'],
})
io.adapter(createAdapter(pubClient, subClient))

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

setupSocketHandlers(io, pubClient)

// ── HTTP Routes ───────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }))
await setupRoomRoutes(app)

// ── Start ─────────────────────────────────────────────────────────────────────
await app.listen({ port: PORT, host: '0.0.0.0' })
console.log(`🚀 Server running on port ${PORT}`)
