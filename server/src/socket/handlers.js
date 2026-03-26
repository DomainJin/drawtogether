import {
  getRoomById,
  getRoomStrokes,
  saveStroke,
  undoLastStroke,
  clearRoom,
  touchRoom,
  createRoom,
} from '../db/index.js'
import { nanoid } from 'nanoid'

// Theo dõi presence: roomId -> Map<socketId, userInfo>
const roomPresence = new Map()

export function setupSocketHandlers(io, redis) {
  io.on('connection', (socket) => {
    const { userId, displayName, color } = socket.user
    console.log(`[WS] connected: ${displayName} (${socket.id})`)

    // ── JOIN ROOM ─────────────────────────────────────────────────────────────
    socket.on('room:join', async ({ roomId }, ack) => {
      try {
        // Tự động tạo room nếu chưa có (ai có link thì vào được)
        let room = await getRoomById(roomId)
        if (!room) {
          room = await createRoom(roomId, `Board #${roomId}`, userId)
        }

        await socket.join(roomId)
        socket.currentRoom = roomId

        // Lưu presence vào memory (nhanh hơn Redis cho danh sách nhỏ)
        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map())
        roomPresence.get(roomId).set(socket.id, { userId, displayName, color, socketId: socket.id })

        // Load lịch sử strokes từ DB
        const strokes = await getRoomStrokes(roomId)

        // Thông báo cho những người đang trong phòng
        socket.to(roomId).emit('user:joined', { userId, displayName, color, socketId: socket.id })

        // Gửi state hiện tại cho người vừa vào
        ack?.({
          ok: true,
          room,
          strokes,
          users: [...(roomPresence.get(roomId)?.values() || [])],
        })

        await touchRoom(roomId)
        console.log(`[WS] ${displayName} joined room ${roomId}`)
      } catch (err) {
        console.error('[WS] room:join error', err)
        ack?.({ ok: false, error: err.message })
      }
    })

    // ── DRAW STROKE ───────────────────────────────────────────────────────────
    // Nhận stroke hoàn chỉnh khi user nhấc bút
    socket.on('draw:stroke', async (stroke) => {
      const roomId = socket.currentRoom
      if (!roomId) return

      // Gắn thêm metadata
      const fullStroke = {
        ...stroke,
        id: nanoid(),
        userId,
        displayName,
        color: stroke.color,
        ts: Date.now(),
      }

      // Broadcast ngay cho các user khác (không await DB)
      socket.to(roomId).emit('draw:stroke', fullStroke)

      // Lưu vào DB bất đồng bộ
      saveStroke({ ...fullStroke, roomId }).catch(console.error)
    })

    // ── DRAW PREVIEW ──────────────────────────────────────────────────────────
    // Gửi real-time trong khi đang vẽ (chưa hoàn thành nét)
    // Không lưu DB, chỉ broadcast để các user thấy preview
    socket.on('draw:preview', (data) => {
      const roomId = socket.currentRoom
      if (!roomId) return
      socket.to(roomId).emit('draw:preview', { ...data, userId, socketId: socket.id })
    })

    // ── CURSOR MOVE ───────────────────────────────────────────────────────────
    // Throttle ở client, server chỉ forward
    socket.on('cursor:move', (data) => {
      const roomId = socket.currentRoom
      if (!roomId) return
      socket.to(roomId).emit('cursor:move', { ...data, userId, displayName, color, socketId: socket.id })
    })

    // ── UNDO ─────────────────────────────────────────────────────────────────
    socket.on('draw:undo', async () => {
      const roomId = socket.currentRoom
      if (!roomId) return
      const deletedId = await undoLastStroke(roomId, userId)
      if (deletedId) {
        io.to(roomId).emit('draw:undo', { strokeId: deletedId, userId })
      }
    })

    // ── CLEAR BOARD ───────────────────────────────────────────────────────────
    socket.on('board:clear', async () => {
      const roomId = socket.currentRoom
      if (!roomId) return
      await clearRoom(roomId)
      io.to(roomId).emit('board:clear', { by: displayName })
    })

    // ── DISCONNECT ────────────────────────────────────────────────────────────
    socket.on('disconnecting', () => {
      const roomId = socket.currentRoom
      if (roomId) {
        roomPresence.get(roomId)?.delete(socket.id)
        if (roomPresence.get(roomId)?.size === 0) roomPresence.delete(roomId)
        socket.to(roomId).emit('user:left', { userId, displayName, socketId: socket.id })
      }
    })

    socket.on('disconnect', () => {
      console.log(`[WS] disconnected: ${displayName}`)
    })
  })
}
