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

// ── Anthropic proxy (tránh CORS khi gọi từ browser) ──────────────────────────
export async function setupAnimateRoute(app) {
  app.post('/api/animate/identify', { preHandler: [authenticateOptional] }, async (req, reply) => {
    const { imageBase64 } = req.body || {}
    if (!imageBase64) return reply.code(400).send({ error: 'Missing imageBase64' })

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return reply.code(500).send({ error: 'ANTHROPIC_API_KEY not set on server' })

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 50,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
              { type: 'text', text: 'What is drawn in this image? Reply with ONLY one English word (the object name). Examples: fish, car, bird, person, ball, flower, tree, boat, butterfly, star, plane.' }
            ]
          }]
        })
      })
      const data = await res.json()
      const label = data.content?.[0]?.text?.trim().toLowerCase().split(/\s+/)[0] || 'object'
      return reply.send({ label })
    } catch (err) {
      return reply.code(500).send({ error: err.message })
    }
  })
}

async function authenticateOptional(req) {
  try { await req.jwtVerify() } catch {}
}
