import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/index.js'
import { getSocket } from '../hooks/useSocket.js'
import { nanoid } from 'nanoid'

const CURSOR_THROTTLE_MS = 32
const CANVAS_SIZE = 4000
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5

export default function WhiteboardCanvas({ canvasRef, viewportRef, zoomRef }) {
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
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  }, [canvasRef])

  // Remote clear
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleClear = () => {
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fafafa'
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }
    canvas.addEventListener('remote:clear', handleClear)
    return () => canvas.removeEventListener('remote:clear', handleClear)
  }, [canvasRef])

  // Lấy toạ độ canvas thực (chia cho zoom)
  const getPos = useCallback((clientX, clientY) => {
    const vp = viewportRef.current
    const zoom = zoomRef.current
    const rect = vp.getBoundingClientRect()
    return {
      x: (clientX - rect.left + vp.scrollLeft) / zoom,
      y: (clientY - rect.top + vp.scrollTop) / zoom,
    }
  }, [viewportRef, zoomRef])

  const drawSegment = useCallback((points) => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')
    const i = points.length - 2
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.strokeStyle = tool === 'eraser' ? '#fafafa' : color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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

  // ── Mouse (PC) ────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    isDrawing.current = true
    currentPoints.current = [getPos(e.clientX, e.clientY)]
    currentStrokeId.current = nanoid()
  }, [getPos])

  const onMouseMove = useCallback((e) => {
    const pos = getPos(e.clientX, e.clientY)
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
  }, [getPos, drawSegment, tool, color, width, opacity])

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

  // ── Touch (Mobile): 1 ngón vẽ, 2 ngón pinch-zoom + pan ───────────────────
  const lastTouchDist = useRef(null)
  const lastTouchMid = useRef(null)

  const getTouchDist = (t1, t2) => {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx*dx + dy*dy)
  }

  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      e.preventDefault()
      isDrawing.current = true
      currentPoints.current = [getPos(e.touches[0].clientX, e.touches[0].clientY)]
      currentStrokeId.current = nanoid()
      lastTouchDist.current = null
    } else if (e.touches.length === 2) {
      // Dừng vẽ nếu đang vẽ
      if (isDrawing.current) {
        isDrawing.current = false
        currentPoints.current = []
      }
      lastTouchDist.current = getTouchDist(e.touches[0], e.touches[1])
      lastTouchMid.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }, [getPos])

  const onTouchMove = useCallback((e) => {
    if (e.touches.length === 1 && isDrawing.current) {
      e.preventDefault()
      const pos = getPos(e.touches[0].clientX, e.touches[0].clientY)
      currentPoints.current.push(pos)
      drawSegment(currentPoints.current)
      const socket = getSocket()
      if (socket && currentPoints.current.length % 3 === 0) {
        socket.emit('draw:preview', {
          id: currentStrokeId.current, tool, color, width, opacity,
          points: currentPoints.current.slice(-4),
        })
      }
    } else if (e.touches.length === 2) {
      e.preventDefault()
      const vp = viewportRef.current
      if (!vp) return

      const newDist = getTouchDist(e.touches[0], e.touches[1])
      const newMid = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }

      if (lastTouchDist.current && lastTouchMid.current) {
        const scale = newDist / lastTouchDist.current
        const oldZoom = zoomRef.current

        // Zoom về điểm giữa 2 ngón
        const rect = vp.getBoundingClientRect()
        const pivotX = newMid.x - rect.left
        const pivotY = newMid.y - rect.top

        const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * scale))
        zoomRef.current = newZoom

        // Dispatch để WhiteboardPage update scale
        vp.dispatchEvent(new CustomEvent('zoom:change', { detail: { zoom: newZoom, pivotX, pivotY, oldZoom } }))

        // Pan theo di chuyển điểm giữa
        const dx = newMid.x - lastTouchMid.current.x
        const dy = newMid.y - lastTouchMid.current.y
        vp.scrollLeft -= dx
        vp.scrollTop -= dy
      }

      lastTouchDist.current = newDist
      lastTouchMid.current = newMid
    }
  }, [getPos, drawSegment, viewportRef, zoomRef, tool, color, width, opacity])

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      lastTouchDist.current = null
      lastTouchMid.current = null
    }
    finishStroke()
  }, [finishStroke])

  // Gắn touch events passive:false
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

  // Ctrl+Z undo
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
        // Kích thước hiển thị = canvas size * zoom (CSS scale)
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        touchAction: 'none',
        transformOrigin: '0 0',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={finishStroke}
      onMouseLeave={finishStroke}
    />
  )
}
