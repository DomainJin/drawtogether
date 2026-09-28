/** Giao thức socket của Performance mode — docs/performance/SPEC.md §4.
 *
 *  Tách hẳn khỏi handlers.js: khán giả quét QR không có JWT, không vào phòng
 *  whiteboard; quyền admin đi bằng adminKey của sự kiện. */
import { nanoid } from 'nanoid'
import { CONFIG_SCHEMA, sanitizeConfig } from '../perf/configSchema.js'
import { SIGNATURE_LIMITS, validateSignature } from '../perf/signature.js'
import {
  getPerfEvent, savePerfConfig, listSignatures, countSignatures, insertSignature,
  setSignatureStatus, deleteSignature, clearSignatures,
} from '../db/perf.js'

const ROLES = ['admin', 'show', 'signer']
const STATUSES = ['visible', 'pending', 'hidden']
const viewersRoom = (id) => `perf:${id}:viewers`
const signersRoom = (id) => `perf:${id}:signers`

/** Config đang dùng của từng sự kiện — tránh đọc DB mỗi lần có người ký.
 *  Chỉ một process giữ cache này; chạy nhiều instance thì phải bỏ cache. */
const configCache = new Map()

async function loadEvent(eventId) {
  const found = await getPerfEvent(eventId)
  if (found) configCache.set(eventId, found.config)
  return found
}

async function currentConfig(eventId) {
  return configCache.get(eventId) ?? (await loadEvent(eventId))?.config ?? null
}

/** Bọc handler: bắt mọi lỗi và luôn trả ack — client đang chờ ack sẽ không
 *  treo tới timeout chỉ vì một lỗi DB. */
function handle(fn) {
  return async (payload, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {}
    try {
      reply(await fn(payload ?? {}))
    } catch (err) {
      console.error('[perf] handler error:', err)
      reply({ ok: false, error: 'server_error' })
    }
  }
}

export function setupPerfHandlers(io) {
  io.on('connection', (socket) => {
    const requireAdmin = () => (socket.data.perf?.isAdmin ? socket.data.perf.eventId : null)

    socket.on('perf:join', handle(async ({ eventId, role, adminKey }) => {
      if (typeof eventId !== 'string' || !ROLES.includes(role)) return { ok: false, error: 'bad_request' }
      const found = await loadEvent(eventId)
      if (!found) return { ok: false, error: 'not_found' }

      const isAdmin = typeof adminKey === 'string' && adminKey === found.adminKey
      if (role === 'admin' && !isAdmin) return { ok: false, error: 'bad_key' }

      // Join lại (reconnect, hoặc đổi sự kiện) — rời phòng cũ trước.
      const prev = socket.data.perf
      if (prev) {
        socket.leave(viewersRoom(prev.eventId))
        socket.leave(signersRoom(prev.eventId))
      }
      socket.data.perf = { eventId, role, isAdmin }
      socket.join(role === 'signer' ? signersRoom(eventId) : viewersRoom(eventId))

      const res = { ok: true, event: found.event, config: found.config, isAdmin }
      if (role !== 'signer') res.signatures = await listSignatures(eventId, SIGNATURE_LIMITS.MAX_PER_EVENT)
      if (isAdmin) res.schema = CONFIG_SCHEMA
      return res
    }))

    socket.on('perf:sign', handle(async (payload) => {
      const eventId = socket.data.perf?.eventId
      if (!eventId) return { ok: false, error: 'not_joined' }

      const now = Date.now()
      if (now - (socket.data.lastSignAt ?? 0) < SIGNATURE_LIMITS.SUBMIT_COOLDOWN_MS) {
        return { ok: false, error: 'too_fast' }
      }

      const checked = validateSignature(payload)
      if (!checked.ok) return checked
      const config = await currentConfig(eventId)
      if (!config) return { ok: false, error: 'not_found' }
      if (config.sign.nameField === 'required' && !checked.value.name) return { ok: false, error: 'name_required' }
      if (await countSignatures(eventId) >= SIGNATURE_LIMITS.MAX_PER_EVENT) return { ok: false, error: 'event_full' }

      socket.data.lastSignAt = now
      const status = config.moderation.requireApproval ? 'pending' : 'visible'
      const { signature, created } = await insertSignature(eventId, nanoid(12), checked.value, status)
      if (created) io.to(viewersRoom(eventId)).emit('perf:sig:add', signature)
      return { ok: true, id: signature.id, status: signature.status }
    }))

    socket.on('perf:config', handle(async ({ config }) => {
      const eventId = requireAdmin()
      if (!eventId) return { ok: false, error: 'forbidden' }
      const next = sanitizeConfig(config, await currentConfig(eventId))
      await savePerfConfig(eventId, next)
      configCache.set(eventId, next)
      // Không gửi lại cho chính người sửa: bản của họ có thể đã mới hơn bản này
      // (đang kéo slider), echo về sẽ làm slider giật lùi.
      socket.to(viewersRoom(eventId)).to(signersRoom(eventId)).emit('perf:config', { config: next })
      return { ok: true, config: next }
    }))

    socket.on('perf:sig:status', handle(async ({ id, status }) => {
      const eventId = requireAdmin()
      if (!eventId) return { ok: false, error: 'forbidden' }
      if (typeof id !== 'string' || !STATUSES.includes(status)) return { ok: false, error: 'bad_request' }
      if (!(await setSignatureStatus(eventId, id, status))) return { ok: false, error: 'not_found' }
      io.to(viewersRoom(eventId)).emit('perf:sig:update', { id, status })
      return { ok: true }
    }))

    socket.on('perf:sig:delete', handle(async ({ id }) => {
      const eventId = requireAdmin()
      if (!eventId) return { ok: false, error: 'forbidden' }
      if (typeof id !== 'string') return { ok: false, error: 'bad_request' }
      if (!(await deleteSignature(eventId, id))) return { ok: false, error: 'not_found' }
      io.to(viewersRoom(eventId)).emit('perf:sig:delete', { id })
      return { ok: true }
    }))

    socket.on('perf:sig:clear', handle(async () => {
      const eventId = requireAdmin()
      if (!eventId) return { ok: false, error: 'forbidden' }
      const count = await clearSignatures(eventId)
      io.to(viewersRoom(eventId)).emit('perf:sig:clear', {})
      return { ok: true, count }
    }))
  })
}
