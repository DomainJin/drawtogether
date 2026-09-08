const BRIDGE_ROOM = 'waterfall-bridge'

function getBridgeSecret() {
  return process.env.WATERFALL_BRIDGE_SECRET || null
}

/** Đếm bridge đang online.
 *
 *  fetchSockets() đi qua Redis adapter nên là lời gọi liên node — nó có thể
 *  timeout hoặc reject khi Redis chập chờn. Trước đây lỗi đó thành unhandled
 *  rejection và làm process thoát (Node >= 15), kéo theo TOÀN BỘ client trong
 *  phòng bị rớt socket. Nuốt lỗi tại đây và trả -1 để caller phân biệt được
 *  "không có bridge" (0) với "không đếm được" (-1). */
async function bridgeCount(io) {
  try {
    const sockets = await io.in(BRIDGE_ROOM).fetchSockets()
    return sockets.length
  } catch (err) {
    console.error('[Waterfall] Không đếm được bridge:', err?.message || err)
    return -1
  }
}

let lastKnownStatus = null

export function setupWaterfallHandlers(io) {
  const secret = getBridgeSecret()
  if (!secret) {
    console.warn('⚠️  WATERFALL_BRIDGE_SECRET chưa cấu hình — mode Màn nước (bridge relay) sẽ từ chối mọi bridge cho tới khi đặt biến môi trường này.')
  } else {
    // Log độ dài thay vì giá trị — đủ để phát hiện paste thừa space mà không lộ secret.
    console.log(`✅ WATERFALL_BRIDGE_SECRET đã cấu hình (${secret.length} ký tự)`)
  }

  io.on('connection', (socket) => {
    socket.isWaterfallBridge = false

    bridgeCount(io).then((count) => {
      socket.emit('waterfall:bridge-online', { online: count > 0 })
      if (lastKnownStatus) socket.emit('waterfall:status', lastKnownStatus)
    })


    socket.on('waterfall:bridge:register', ({ secret: given, label } = {}, ack) => {
      const expected = getBridgeSecret()
      if (!expected) {
        return ack?.({ ok: false, error: 'Server chưa cấu hình WATERFALL_BRIDGE_SECRET' })
      }
      if (given !== expected) {
        console.warn(`[Waterfall] Bridge register bị từ chối (sai secret) từ socket ${socket.id}`)
        return ack?.({ ok: false, error: 'Sai bridge secret' })
      }
      socket.isWaterfallBridge = true
      socket.waterfallLabel = label || socket.id
      socket.join(BRIDGE_ROOM)
      console.log(`[Waterfall] Bridge "${socket.waterfallLabel}" đã đăng ký`)
      ack?.({ ok: true })
      io.emit('waterfall:bridge-online', { online: true })
    })

    socket.on('waterfall:status', (status) => {
      if (!socket.isWaterfallBridge) return
      lastKnownStatus = status
      io.emit('waterfall:status', status)
    })

    socket.on('waterfall:frames', async (frames, ack) => {
      if (socket.isWaterfallBridge) return
      try {
        const count = await bridgeCount(io)
        if (count === 0) {
          return ack?.({ ok: false, error: 'Chưa có bridge nào kết nối tới màn nước' })
        }
        if (count < 0) {
          return ack?.({ ok: false, error: 'Server không kiểm tra được bridge, thử lại' })
        }
        io.to(BRIDGE_ROOM).emit('waterfall:frames', frames)
        ack?.({ ok: true })
      } catch (err) {
        // Trả lỗi về client thay vì để rejection thoát ra và giết process.
        console.error('[Waterfall] Relay frames lỗi:', err?.message || err)
        ack?.({ ok: false, error: 'Server lỗi khi chuyển hoạ tiết tới bridge' })
      }
    })

    socket.on('waterfall:cmd', async (cmd, ack) => {
      if (socket.isWaterfallBridge) return
      try {
        const count = await bridgeCount(io)
        if (count === 0) {
          return ack?.({ ok: false, error: 'Chưa có bridge nào kết nối tới màn nước' })
        }
        if (count < 0) {
          return ack?.({ ok: false, error: 'Server không kiểm tra được bridge, thử lại' })
        }
        io.to(BRIDGE_ROOM).emit('waterfall:cmd', cmd)
        ack?.({ ok: true })
      } catch (err) {
        console.error('[Waterfall] Relay cmd lỗi:', err?.message || err)
        ack?.({ ok: false, error: 'Server lỗi khi chuyển lệnh tới bridge' })
      }
    })

    socket.on('disconnecting', () => {
      if (!socket.isWaterfallBridge) return
      console.log(`[Waterfall] Bridge "${socket.waterfallLabel}" ngắt kết nối`)
      setImmediate(async () => {
        if ((await bridgeCount(io)) === 0) {  // -1 (không đếm được) không coi là offline
          lastKnownStatus = { status: 'disconnected', valveCount: null, valveBytes: null, tickMs: null, error: null }
          io.emit('waterfall:bridge-online', { online: false })
          io.emit('waterfall:status', lastKnownStatus)
        }
      })
    })
  })
}
