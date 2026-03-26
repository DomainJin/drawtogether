import { nanoid } from 'nanoid'
import { createUser, createRoom, getRoomById } from '../db/index.js'

const USER_COLORS = [
  '#E24B4A', '#378ADD', '#1D9E75', '#EF9F27',
  '#D4537E', '#7F77DD', '#D85A30', '#639922',
]

export async function setupRoomRoutes(app) {
  // Tạo user ẩn danh + JWT token (gọi khi user mở app lần đầu)
  app.post('/api/auth/guest', async (req, reply) => {
    const { displayName } = req.body || {}
    const name = (displayName || 'Anonymous').slice(0, 32)
    const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)]
    const user = await createUser(name, color)
    const token = app.jwt.sign({ userId: user.id, displayName: user.display_name, color: user.color })
    return reply.send({ token, user })
  })

  // Tạo phòng mới
  app.post('/api/rooms', { preHandler: [authenticate] }, async (req, reply) => {
    const { name } = req.body || {}
    const roomId = nanoid(10) // e.g. "V1StGXR8_Z"
    const room = await createRoom(roomId, name || `Board #${roomId}`, req.user.userId)
    return reply.send({ room, link: `${process.env.CLIENT_URL || ''}/${roomId}` })
  })

  // Kiểm tra phòng có tồn tại không
  app.get('/api/rooms/:id', async (req, reply) => {
    const room = await getRoomById(req.params.id)
    if (!room) return reply.code(404).send({ error: 'Room not found' })
    return reply.send({ room })
  })
}

async function authenticate(req, reply) {
  try {
    await req.jwtVerify()
  } catch {
    reply.code(401).send({ error: 'Unauthorized' })
  }
}
