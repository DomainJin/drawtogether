/** REST của Performance mode — docs/performance/SPEC.md §5. */
import { networkInterfaces } from 'node:os'
import { randomBytes } from 'node:crypto'
import { nanoid } from 'nanoid'
import { defaultConfig } from '../perf/configSchema.js'
import { MEDIA_TYPES, MediaError, openMedia, saveMedia } from '../perf/mediaStore.js'
import { createPerfEvent, getPerfEvent } from '../db/perf.js'

const EVENT_ID_LEN = 8
const MAX_NAME_CHARS = 60

/** IPv4 LAN của máy chủ — trang setup gợi ý làm gốc URL cho QR, vì mở setup
 *  bằng localhost thì QR "localhost" vô dụng với điện thoại khán giả. */
export function lanAddresses(ifaces = networkInterfaces()) {
  const out = []
  for (const list of Object.values(ifaces)) {
    for (const a of list ?? []) {
      const v4 = a.family === 'IPv4' || a.family === 4
      if (v4 && !a.internal) out.push(a.address)
    }
  }
  return out
}

export async function setupPerfRoutes(app) {
  // Body upload là file thô: chuyển nguyên stream cho mediaStore (nó tự giới
  // hạn dung lượng). Fastify không buffer, nên video trăm MB không nằm trong RAM.
  app.addContentTypeParser(Object.keys(MEDIA_TYPES), (_req, payload, done) => done(null, payload))

  app.post('/api/perf/events', async (req, reply) => {
    const raw = typeof req.body?.name === 'string' ? req.body.name.trim() : ''
    const name = (raw || 'Sự kiện').slice(0, MAX_NAME_CHARS)
    // id ngắn vì nằm trong QR — QR càng ngắn càng thưa, quét càng nhanh.
    const id = nanoid(EVENT_ID_LEN)
    const adminKey = randomBytes(18).toString('base64url')
    const event = await createPerfEvent(id, name, adminKey, defaultConfig())
    return reply.send({ event, adminKey })
  })

  app.get('/api/perf/events/:id', async (req, reply) => {
    const found = await getPerfEvent(req.params.id)
    if (!found) return reply.code(404).send({ error: 'not_found' })
    return reply.send({ event: found.event })
  })

  app.post('/api/perf/events/:id/media', async (req, reply) => {
    const found = await getPerfEvent(req.params.id)
    if (!found) return reply.code(404).send({ error: 'not_found' })
    if (req.headers['x-perf-key'] !== found.adminKey) return reply.code(403).send({ error: 'forbidden' })

    const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase()
    try {
      return reply.send(await saveMedia(req.params.id, mime, req.body))
    } catch (err) {
      const status = err instanceof MediaError ? err.status : 500
      if (status >= 500) req.log.error(err)
      return reply.code(status).send({ error: err.code || 'upload_failed' })
    }
  })

  app.get('/api/perf/media/:eventId/:file', async (req, reply) => {
    try {
      const { stream, size, mime, range } = await openMedia(req.params.eventId, req.params.file, req.headers.range)
      reply.header('Accept-Ranges', 'bytes')
      reply.header('Content-Type', mime)
      // Tên file là id ngẫu nhiên, không bao giờ bị ghi đè → cache mạnh tay.
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      if (range === 'unsatisfiable') {
        return reply.code(416).header('Content-Range', `bytes */${size}`).send()
      }
      if (range) {
        reply.code(206)
        reply.header('Content-Range', `bytes ${range.start}-${range.end}/${size}`)
        reply.header('Content-Length', range.end - range.start + 1)
      } else {
        reply.header('Content-Length', size)
      }
      return reply.send(stream)
    } catch (err) {
      const status = err instanceof MediaError ? err.status : 500
      return reply.code(status).send({ error: err.code || 'read_failed' })
    }
  })

  app.get('/api/perf/lan', async () => ({ addresses: lanAddresses() }))
}
