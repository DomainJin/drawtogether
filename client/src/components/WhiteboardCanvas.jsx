import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/index.js'
import { getSocket, renderStroke } from '../hooks/useSocket.js'
import { nanoid } from 'nanoid'

const CURSOR_THROTTLE_MS = 32 // ~30fps cho cursor

export default function WhiteboardCanvas({ canvasRef }) {
  const { tool, color, width, opacity, user } = useStore()
  const isDrawing = useRef(false)
  const currentPoints = useRef([])
  const currentStrokeId = useRef(null)
  const lastCursorEmit = useRef(0)
  const previewLayerRef = useRef({}) // { socketId: points[] }
  const strokeHistoryRef = useRef([]) // local undo history
  const containerRef = useRef(null)

  // Resize canvas theo container
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => {
      const { width: w, height: h } = canvas.parentElement.getBoundingClientRect()
      // Lưu nội dung trước khi resize
      const img = canvas.toDataURL()
      canvas.width = w
      canvas.height = h
      // Vẽ lại sau resize
      const img2 = new Image()
      img2.onload = () => canvas.getContext('2d').drawImage(img2, 0, 0)
      img2.src = img
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement)
    return () => ro.disconnect()
  }, [canvasRef])

  // Lắng nghe sự kiện từ socket
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleRemoteUndo = () => {
      // Đơn giản nhất: reload strokes từ server (socket handler sẽ emit lại)
      // Hoặc rebuild từ strokeHistory nếu muốn offline-first
      window.location.reload()
    }

    canvas.addEventListener('remote:undo', handleRemoteUndo)
    return () => canvas.removeEventListener('remote:undo', handleRemoteUndo)
  }, [canvasRef])

  // ── Pointer helpers ───────────────────────────────────────────────────────
  const getPos = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }, [canvasRef])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    isDrawing.current = true
    currentPoints.current = [getPos(e)]
    currentStrokeId.current = nanoid()
  }, [getPos])

  const onPointerMove = useCallback((e) => {
    e.preventDefault()
    const pos = getPos(e)
    const socket = getSocket()

    // Emit cursor (throttled)
    const now = Date.now()
    if (socket && now - lastCursorEmit.current > CURSOR_THROTTLE_MS) {
      socket.emit('cursor:move', pos)
      lastCursorEmit.current = now
    }

    if (!isDrawing.current) return

    currentPoints.current.push(pos)
    const points = currentPoints.current

    // Vẽ local ngay (không chờ server)
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (points.length >= 2) {
      ctx.save()
      ctx.globalAlpha = opacity
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
      ctx.lineWidth = width
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out'
      ctx.beginPath()
      const i = points.length - 2
      if (points.length === 2) {
        ctx.moveTo(points[0].x, points[0].y)
        ctx.lineTo(points[1].x, points[1].y)
      } else {
        const mx = (points[i].x + points[i + 1].x) / 2
        const my = (points[i].y + points[i + 1].y) / 2
        ctx.moveTo((points[i - 1].x + points[i].x) / 2, (points[i - 1].y + points[i].y) / 2)
        ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
      }
      ctx.stroke()
      ctx.restore()
    }

    // Gửi preview cho người khác (mỗi 3 điểm để giảm traffic)
    if (socket && points.length % 3 === 0) {
      socket.emit('draw:preview', {
        id: currentStrokeId.current,
        tool, color, width, opacity,
        points: points.slice(-4), // chỉ gửi vài điểm gần nhất
      })
    }
  }, [getPos, tool, color, width, opacity])

  const onPointerUp = useCallback((e) => {
    if (!isDrawing.current) return
    isDrawing.current = false

    const points = currentPoints.current
    if (points.length < 2) return

    const stroke = {
      id: currentStrokeId.current,
      tool, color, width, opacity, points,
    }

    // Lưu local history để undo
    strokeHistoryRef.current.push(stroke)

    // Gửi stroke hoàn chỉnh lên server
    getSocket()?.emit('draw:stroke', stroke)

    currentPoints.current = []
  }, [tool, color, width, opacity])

  // Undo local
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        getSocket()?.emit('draw:undo')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  )
}
