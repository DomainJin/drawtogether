/** Kết nối socket cho một vai trò (admin/show/signer) của một sự kiện.
 *
 *  Socket riêng, không dùng chung socket whiteboard (hooks/useSocket.js): khán
 *  giả không có JWT, và màn show chạy cả buổi — không được dính logic phòng vẽ.
 *  Mỗi lần (re)connect đều join lại và nhận TOÀN BỘ state (SPEC §4). */
import { io } from 'socket.io-client'
import { SERVER_URL } from '../whiteboard/serverUrl.js'
import { PERF_CONFIG as P } from './config.js'

const PUSH_EVENTS = ['perf:config', 'perf:sig:add', 'perf:sig:update', 'perf:sig:delete', 'perf:sig:clear']

/** emit có ack + timeout. Không bao giờ treo: hết giờ → {ok:false, error:'timeout'}. */
export async function emitAck(socket, event, payload, timeoutMs) {
  try {
    return await socket.timeout(timeoutMs).emitWithAck(event, payload)
  } catch {
    return { ok: false, error: 'timeout' }
  }
}

/** Thử lại có giới hạn, chỉ với lỗi mạng (timeout). Lỗi nghiệp vụ trả ngay.
 *  Payload phải idempotent (chữ ký có cid) — server có thể đã nhận lần trước. */
export async function emitWithRetry(socket, event, payload, { timeoutMs, retries }) {
  let res
  for (let i = 0; i <= retries; i++) {
    res = await emitAck(socket, event, payload, timeoutMs)
    if (res?.error !== 'timeout') return res
  }
  return res
}

/**
 * @param {object} p
 * @param {string} p.eventId
 * @param {'admin'|'show'|'signer'} p.role
 * @param {string} [p.adminKey]
 * @param {(res) => void} p.onJoined   ack của perf:join (mỗi lần connect)
 * @param {(err: string) => void} p.onError
 * @param {(connected: boolean) => void} p.onConnection
 * @param {Record<string, Function>} p.handlers  push event → handler
 * @returns {{socket, close}}
 */
export function connectPerf({ eventId, role, adminKey, onJoined, onError, onConnection, handlers = {} }) {
  const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  })

  socket.on('connect', async () => {
    onConnection?.(true)
    const res = await emitAck(socket, 'perf:join', { eventId, role, adminKey }, P.JOIN_TIMEOUT_MS)
    if (!socket.connected) return
    if (res?.ok) onJoined?.(res)
    else if (res?.error === 'timeout') socket.disconnect().connect() // thử lại cả vòng
    else onError?.(res?.error || 'join_failed')
  })
  socket.on('disconnect', () => onConnection?.(false))
  socket.on('connect_error', () => onConnection?.(false))

  for (const ev of PUSH_EVENTS) {
    if (handlers[ev]) socket.on(ev, handlers[ev])
  }

  return {
    socket,
    close: () => {
      socket.removeAllListeners()
      socket.disconnect()
    },
  }
}
