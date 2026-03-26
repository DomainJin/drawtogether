import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useStore } from '../store/index.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

let socketInstance = null

export function getSocket() {
  return socketInstance
}

export function useSocket(roomId, canvasRef) {
  const { token, setRoom, setUsers, addUser, removeUser, setCursor, removeCursor, setConnected } = useStore()
  const connectedRef = useRef(false)

  const drawRemoteStroke = useCallback((stroke) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    renderStroke(ctx, stroke)
  }, [canvasRef])

  const drawRemotePreview = useCallback((data) => {
    // Preview layer được handle trong WhiteboardCanvas
    canvasRef.current?.dispatchEvent(new CustomEvent('remote:preview', { detail: data }))
  }, [canvasRef])

  useEffect(() => {
    if (!token || !roomId || connectedRef.current) return
    connectedRef.current = true

    // Tạo socket với JWT token
    socketInstance = io(SERVER_URL, {
      auth: { token },
      transports: ['websocket'],
    })

    socketInstance.on('connect', () => {
      setConnected(true)
      console.log('[Socket] connected', socketInstance.id)

      // Join room ngay sau khi connect
      socketInstance.emit('room:join', { roomId }, (res) => {
        if (!res.ok) return console.error('Failed to join room:', res.error)
        setRoom(res.room)
        setUsers(res.users.filter(u => u.socketId !== socketInstance.id))

        // Vẽ lại toàn bộ lịch sử lên canvas
        const canvas = canvasRef.current
        if (canvas && res.strokes.length > 0) {
          const ctx = canvas.getContext('2d')
          res.strokes.forEach(s => renderStroke(ctx, s))
        }
      })
    })

    socketInstance.on('disconnect', () => {
      setConnected(false)
      console.log('[Socket] disconnected')
    })

    // Ai đó vào phòng
    socketInstance.on('user:joined', (user) => addUser(user))

    // Ai đó rời phòng
    socketInstance.on('user:left', ({ socketId, displayName }) => {
      removeUser(socketId)
      removeCursor(socketId)
      console.log(`${displayName} left`)
    })

    // Nhận stroke hoàn chỉnh từ người khác
    socketInstance.on('draw:stroke', (stroke) => drawRemoteStroke(stroke))

    // Nhận preview đang vẽ
    socketInstance.on('draw:preview', (data) => drawRemotePreview(data))

    // Nhận cursor
    socketInstance.on('cursor:move', ({ socketId, x, y, displayName, color }) => {
      setCursor(socketId, { x, y, displayName, color })
    })

    // Undo
    socketInstance.on('draw:undo', ({ strokeId }) => {
      // Cần rebuild canvas — gửi event để WhiteboardCanvas xử lý
      canvasRef.current?.dispatchEvent(new CustomEvent('remote:undo', { detail: { strokeId } }))
    })

    // Clear
    socketInstance.on('board:clear', ({ by }) => {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    })

    return () => {
      socketInstance?.disconnect()
      socketInstance = null
      connectedRef.current = false
      setConnected(false)
    }
  }, [token, roomId]) // eslint-disable-line

  return socketInstance
}

// ── Canvas renderer ───────────────────────────────────────────────────────────
export function renderStroke(ctx, stroke) {
  const { tool, color, width, opacity, points } = stroke
  if (!points || points.length < 2) return

  ctx.save()
  ctx.globalAlpha = opacity ?? 1
  ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  // Bézier curve cho nét mượt
  for (let i = 1; i < points.length - 1; i++) {
    const mx = (points[i].x + points[i + 1].x) / 2
    const my = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y)
  ctx.stroke()
  ctx.restore()
}
