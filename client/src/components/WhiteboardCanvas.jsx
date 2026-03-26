import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store/index.js'
import { getSocket, renderStroke } from '../hooks/useSocket.js'
import { nanoid } from 'nanoid'

const CURSOR_THROTTLE_MS = 32
const CANVAS_SIZE = 4000 // canvas logic lớn, scroll trong đó

export default function WhiteboardCanvas({ canvasRef, viewportRef }) {
  const { tool, color, width, opacity } = useStore()
  const isDrawing = useRef(false)
  const currentPoints = useRef([])
  const currentStrokeId = useRef(null)
  const lastCursorEmit = useRef(0)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

  // Resize canvas một lần
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE
  }, [canvasRef])

  // Lắng nghe remote undo/clear
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleClear = () => {
      canvas.getContext('2d').clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    }
    canvas.addEventListener('remote:clear', handleClear)
    return () => canvas.removeEventListener('remote:clear', handleClear)
  }, [canvasRef])

  // Đồng bộ scroll từ remote
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handleScroll = (e) => {
      const vp = viewportRef.current
      if (!vp) return
      vp.scrollLeft = e.detail.x
      vp.scrollTop = e.detail.y
    }
    canvas.addEventListener('remote:scroll', handleScroll)
    return () => canvas.removeEventListener('remote:scroll', handleScroll)
  }, [canvasRef, viewportRef])

  // Lấy toạ độ canvas từ pointer/touch (tính offset scroll)
  const getPos = useCallback((e) => {
    const vp = viewportRef.current
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const rect = vp.getBoundingClientRect()
    return {
      x: clientX - rect.left + vp.scrollLeft,
      y: clientY - rect.top + vp.scrollTop,
    }
  }, [viewportRef])

  // ── Vẽ local (realtime, không chờ server) ────────────────────────────────
  const drawLocal = useCallback((points) => {
    const canvas = canvasRef.current
    if (!canvas || points.length < 2) return
    const ctx = canvas.getContext('2d')
    const i = points.length - 2
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(250,250,250,1)' : color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out'
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

  // ── Pointer events ────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    // Chỉ vẽ bằng 1 ngón, nếu 2 ngón thì pan
    if (e.touches && e.touches.length === 2) {
      isPanning.current = true
      return
    }
    e.preventDefault()
    isDrawing.current = true
    currentPoints.current = [getPos(e)]
    currentStrokeId.current = nanoid()
  }, [getPos])

  const onPointerMove = useCallback((e) => {
    // Pan bằng 2 ngón tay
    if (e.touches && e.touches.length === 2) {
      return // pinch-to-zoom hoặc 2-finger pan — bỏ qua vẽ
    }

    const pos = getPos(e)
    const socket = getSocket()
    const now = Date.now()

    // Emit cursor (throttled)
    if (socket && now - lastCursorEmit.current > CURSOR_THROTTLE_MS) {
      socket.emit('cursor:move', pos)
      lastCursorEmit.current = now
    }

    if (!isDrawing.current) return
    e.preventDefault()

    currentPoints.current.push(pos)
    drawLocal(currentPoints.current)

    // Gửi preview mỗi 3 điểm
    if (socket && currentPoints.current.length % 3 === 0) {
      socket.emit('draw:preview', {
        id: currentStrokeId.current,
        tool, color, width, opacity,
        points: currentPoints.current.slice(-4),
      })
    }
  }, [getPos, drawLocal, tool, color, width, opacity])

  const onPointerUp = useCallback(() => {
    isPanning.current = false
    if (!isDrawing.current) return
    isDrawing.current = false

    const points = currentPoints.current
    if (points.length < 2) return

    const stroke = {
      id: currentStrokeId.current,
      tool, color, width, opacity, points,
    }
    getSocket()?.emit('draw:stroke', stroke)
    currentPoints.current = []
  }, [tool, color, width, opacity])

  // Undo Ctrl+Z
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
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      style={{
        display: 'block',
        width: CANVAS_SIZE,
        height: CANVAS_SIZE,
        cursor: tool === 'eraser' ? 'cell' : 'crosshair',
        touchAction: 'none',
        background: '#fafafa',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onTouchStart={onPointerDown}
      onTouchMove={onPointerMove}
      onTouchEnd={onPointerUp}
    />
  )
}
