import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/index.js'
import { getSocket } from '../hooks/useSocket.js'
import { nanoid } from 'nanoid'

const CURSOR_THROTTLE_MS = 32
const CANVAS_SIZE = 4000

export default function WhiteboardCanvas({ canvasRef, containerRef, camRef }) {
  const { tool, color, width, opacity } = useStore()
  const isDrawing = useRef(false)
  const currentPoints = useRef([])
  const currentStrokeId = useRef(null)
  const lastCursorEmit = useRef(0)

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [canvasRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleClear = () => {
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }
    canvas.addEventListener('remote:clear', handleClear)
    return () => canvas.removeEventListener('remote:clear', handleClear)
  }, [canvasRef])

  // Chuyển toạ độ màn hình → toạ độ canvas (nghịch đảo transform)
  const screenToCanvas = useCallback((clientX, clientY) => {
    const el = containerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    const { x, y, zoom } = camRef.current
    return {
      x: (clientX - rect.left - x) / zoom,
      y: (clientY - rect.top - y) / zoom,
    }
  }, [containerRef, camRef])

  const drawSegment = useCallback((points) => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')
    const i = points.length - 2
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
    ctx.lineWidth = tool === 'eraser' ? width * 3 : width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'eraser') ctx.globalCompositeOperation = 'source-over'
    ctx.beginPath()
    if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y)
      ctx.lineTo(points[1].x, points[1].y)
    } else {
      const mx = (points[i].x + points[i+1].x) / 2
      const my = (points[i].y + points[i+1].y) / 2
      ctx.moveTo((points[i-1].x + points[i].x)/2, (points[i-1].y + points[i].y)/2)
      ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my)
    }
    ctx.stroke()
    ctx.restore()
  }, [tool, color, width, opacity])

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    // Chỉ vẽ khi không pan (button 0, không giữ space)
    if (e.button !== 0) return
    if (e.currentTarget._isPanning) return
    isDrawing.current = true
    currentPoints.current = [screenToCanvas(e.clientX, e.clientY)]
    currentStrokeId.current = nanoid()
  }, [screenToCanvas])

  const onMouseMove = useCallback((e) => {
    const pos = screenToCanvas(e.clientX, e.clientY)
    const socket = getSocket()
    const now = Date.now()
    if (socket && now - lastCursorEmit.current > CURSOR_THROTTLE_MS) {
      socket.emit('cursor:move', pos)
      lastCursorEmit.current = now
    }
    if (!isDrawing.current) return
    currentPoints.current.push(pos)
    drawSegment(currentPoints.current)
    if (socket && currentPoints.current.length % 3 === 0) {
      socket.emit('draw:preview', {
        id: currentStrokeId.current, tool, color, width, opacity,
        points: currentPoints.current.slice(-4),
      })
    }
  }, [screenToCanvas, drawSegment, tool, color, width, opacity])

  const finishStroke = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const points = currentPoints.current
    if (points.length >= 2) {
      getSocket()?.emit('draw:stroke', {
        id: currentStrokeId.current, tool, color, width, opacity, points,
      })
    }
    currentPoints.current = []
  }, [tool, color, width, opacity])

  // ── Touch: 1 ngón vẽ (2 ngón được handle ở WhiteboardPage) ───────────────
  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) {
      // 2 ngón: dừng vẽ
      finishStroke()
      return
    }
    e.preventDefault()
    const t = e.touches[0]
    isDrawing.current = true
    currentPoints.current = [screenToCanvas(t.clientX, t.clientY)]
    currentStrokeId.current = nanoid()
  }, [screenToCanvas, finishStroke])

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 1 || !isDrawing.current) return
    e.preventDefault()
    const t = e.touches[0]
    const pos = screenToCanvas(t.clientX, t.clientY)
    currentPoints.current.push(pos)
    drawSegment(currentPoints.current)
    const socket = getSocket()
    if (socket && currentPoints.current.length % 3 === 0) {
      socket.emit('draw:preview', {
        id: currentStrokeId.current, tool, color, width, opacity,
        points: currentPoints.current.slice(-4),
      })
    }
  }, [screenToCanvas, drawSegment, tool, color, width, opacity])

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) finishStroke()
  }, [finishStroke])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [canvasRef, onTouchStart, onTouchMove, onTouchEnd])

  // Ctrl+Z
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        getSocket()?.emit('draw:undo')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        touchAction: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={finishStroke}
      onMouseLeave={finishStroke}
    />
  )
}
