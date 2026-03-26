import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'
import { useSocket, getSocket } from '../hooks/useSocket.js'
import WhiteboardCanvas from '../components/WhiteboardCanvas.jsx'
import Toolbar from '../components/Toolbar.jsx'
import CursorOverlay from '../components/CursorOverlay.jsx'
import UserList from '../components/UserList.jsx'

const CANVAS_SIZE = 4000
const MIN_ZOOM = 0.05
const MAX_ZOOM = 8

export default function WhiteboardPage() {
  const { roomId } = useParams()
  const { token, room } = useStore()
  const canvasRef = useRef(null)
  const stageRef = useRef(null)       // div bọc canvas, ta transform cái này
  const containerRef = useRef(null)   // viewport cố định full screen
  const navigate = useNavigate()
  const [uiVisible, setUiVisible] = useState(true)

  // Camera state: { x, y, zoom } — x,y là offset pan
  const cam = useRef({ x: 0, y: 0, zoom: 1 })
  const [zoom, setZoom] = useState(1)

  // Gesture state
  const isPanning = useRef(false)
  const panStart = useRef({ mx: 0, my: 0, cx: 0, cy: 0 })
  const lastPinchDist = useRef(null)
  const lastPinchMid = useRef(null)
  const spaceDown = useRef(false)

  useEffect(() => {
    if (!token) navigate('/', { replace: true })
  }, [token, navigate])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.width = '100%'
    return () => {
      document.body.style.overflow = ''
      document.body.style.position = ''
    }
  }, [])

  // Bắt đầu ở giữa canvas
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    requestAnimationFrame(() => {
      const cx = el.clientWidth / 2 - CANVAS_SIZE / 2
      const cy = el.clientHeight / 2 - CANVAS_SIZE / 2
      cam.current = { x: cx, y: cy, zoom: 1 }
      applyTransform()
    })
  }, [])

  const applyTransform = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const { x, y, zoom: z } = cam.current
    stage.style.transform = `translate(${x}px, ${y}px) scale(${z})`
    setZoom(z)
  }, [])

  // ── Zoom vào điểm (clientX, clientY) ─────────────────────────────────────
  const zoomAt = useCallback((clientX, clientY, factor) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const px = clientX - rect.left   // điểm trong container
    const py = clientY - rect.top

    const oldZ = cam.current.zoom
    const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZ * factor))
    const scale = newZ / oldZ

    // Giữ điểm (px,py) cố định: new_offset = px - scale*(px - old_offset)
    cam.current.x = px - scale * (px - cam.current.x)
    cam.current.y = py - scale * (py - cam.current.y)
    cam.current.zoom = newZ
    applyTransform()
  }, [applyTransform])

  // ── PC: Ctrl+Wheel zoom, Middle-click pan, Space+drag pan ─────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom trên trackpad
        const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
        zoomAt(e.clientX, e.clientY, factor)
      } else {
        // Pan
        cam.current.x -= e.deltaX
        cam.current.y -= e.deltaY
        applyTransform()
      }
    }

    const onKeyDown = (e) => {
      if (e.code === 'Space' && !e.target.matches('input,textarea')) {
        spaceDown.current = true
        el.style.cursor = 'grab'
        e.preventDefault()
      }
    }
    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        spaceDown.current = false
        el.style.cursor = ''
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [zoomAt, applyTransform])

  // ── PC: Space+drag pan & middle-click pan ────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || spaceDown.current) {
      e.preventDefault()
      isPanning.current = true
      panStart.current = { mx: e.clientX, my: e.clientY, cx: cam.current.x, cy: cam.current.y }
      containerRef.current.style.cursor = 'grabbing'
    }
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!isPanning.current) return
    cam.current.x = panStart.current.cx + (e.clientX - panStart.current.mx)
    cam.current.y = panStart.current.cy + (e.clientY - panStart.current.my)
    applyTransform()
  }, [applyTransform])

  const onMouseUp = useCallback(() => {
    isPanning.current = false
    containerRef.current.style.cursor = spaceDown.current ? 'grab' : ''
  }, [])

  // ── Mobile: 1 ngón → canvas xử lý vẽ, 2 ngón → pinch zoom + pan ─────────
  const onTouchStart = useCallback((e) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const t1 = e.touches[0], t2 = e.touches[1]
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      lastPinchDist.current = Math.sqrt(dx*dx + dy*dy)
      lastPinchMid.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
      }
    }
  }, [])

  const onTouchMove = useCallback((e) => {
    if (e.touches.length !== 2) return
    e.preventDefault()
    const t1 = e.touches[0], t2 = e.touches[1]
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    const newDist = Math.sqrt(dx*dx + dy*dy)
    const newMid = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    }

    if (lastPinchDist.current && lastPinchMid.current) {
      const scaleFactor = newDist / lastPinchDist.current

      // Zoom vào điểm giữa 2 ngón
      const el = containerRef.current
      const rect = el.getBoundingClientRect()
      const pivotX = newMid.x - rect.left
      const pivotY = newMid.y - rect.top
      const oldZ = cam.current.zoom
      const newZ = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZ * scaleFactor))
      const s = newZ / oldZ
      cam.current.x = pivotX - s * (pivotX - cam.current.x)
      cam.current.y = pivotY - s * (pivotY - cam.current.y)
      cam.current.zoom = newZ

      // Pan theo di chuyển điểm giữa
      const panDx = newMid.x - lastPinchMid.current.x
      const panDy = newMid.y - lastPinchMid.current.y
      cam.current.x += panDx
      cam.current.y += panDy

      applyTransform()
    }

    lastPinchDist.current = newDist
    lastPinchMid.current = newMid
  }, [applyTransform])

  const onTouchEnd = useCallback((e) => {
    if (e.touches.length < 2) {
      lastPinchDist.current = null
      lastPinchMid.current = null
    }
  }, [])

  useSocket(roomId, canvasRef)

  // Zoom buttons
  const doZoom = useCallback((factor) => {
    const el = containerRef.current
    if (!el) return
    zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor)
  }, [zoomAt])

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `whiteboard-${roomId}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  if (!token) return null

  return (
    <div
      ref={containerRef}
      style={{
        width: '100vw', height: '100dvh',
        position: 'fixed', top: 0, left: 0,
        overflow: 'hidden',
        background: '#e0e0e0',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Canvas layer — transform ở đây */}
      <div
        ref={stageRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: CANVAS_SIZE,
          height: CANVAS_SIZE,
          transformOrigin: '0 0',
          willChange: 'transform',
        }}
      >
        <WhiteboardCanvas canvasRef={canvasRef} containerRef={containerRef} camRef={cam} />
        <CursorOverlay canvasRef={canvasRef} />
      </div>

      {/* Toggle UI */}
      <button
        onClick={() => setUiVisible(v => !v)}
        style={{
          position: 'fixed', top: 12, right: 12, zIndex: 300,
          width: 36, height: 36, borderRadius: 8,
          background: 'rgba(255,255,255,0.95)',
          border: '1px solid rgba(0,0,0,0.1)',
          cursor: 'pointer', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        }}
      >{uiVisible ? '👁' : '✏️'}</button>

      {uiVisible && (
        <>
          <div style={{
            position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
            padding: '7px 14px', zIndex: 200,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            whiteSpace: 'nowrap', maxWidth: 'calc(100vw - 120px)',
          }}>
            <span style={{ fontSize: 16 }}>🎨</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{room?.name || roomId}</span>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Đã copy!') }} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 5,
              border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
              cursor: 'pointer', color: '#378ADD',
            }}>📋 Copy</button>
          </div>

          {/* Zoom controls */}
          <div style={{
            position: 'fixed', bottom: 90, left: 12, zIndex: 200,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}>
            {[
              { label: '+', action: () => doZoom(1.3) },
              { label: `${Math.round(zoom * 100)}%`, action: () => { cam.current.zoom = 1; applyTransform() }, style: { fontSize: 10, width: 38 } },
              { label: '−', action: () => doZoom(1 / 1.3) },
            ].map((b, i) => (
              <button key={i} onClick={b.action} style={{
                width: 34, height: 28, borderRadius: 6, cursor: 'pointer',
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(0,0,0,0.12)',
                fontSize: b.style?.fontSize || 16, fontWeight: 600,
                ...(b.style || {}),
              }}>{b.label}</button>
            ))}
          </div>

          {/* Hint */}
          <div style={{
            position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
            fontSize: 10, color: 'rgba(0,0,0,0.35)', zIndex: 200,
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            PC: Ctrl+scroll zoom · Space+drag pan · Mobile: 2 ngón zoom/pan
          </div>

          <UserList />
          <Toolbar onExport={handleExport} />
        </>
      )}

      <MiniMap camRef={cam} canvasSize={CANVAS_SIZE} containerRef={containerRef} zoom={zoom} />
    </div>
  )
}

function MiniMap({ camRef, canvasSize, containerRef, zoom }) {
  const vpRef = useRef(null)
  const MAP = 64

  useEffect(() => {
    let raf
    const update = () => {
      const vp = vpRef.current
      const el = containerRef.current
      if (!vp || !el) { raf = requestAnimationFrame(update); return }
      const { x, y, zoom: z } = camRef.current
      const vw = (el.clientWidth / (canvasSize * z)) * MAP
      const vh = (el.clientHeight / (canvasSize * z)) * MAP
      const px = (-x / (canvasSize * z)) * MAP
      const py = (-y / (canvasSize * z)) * MAP
      vp.style.left = Math.max(0, px) + 'px'
      vp.style.top = Math.max(0, py) + 'px'
      vp.style.width = Math.min(vw, MAP) + 'px'
      vp.style.height = Math.min(vh, MAP) + 'px'
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [camRef, canvasSize, containerRef, zoom])

  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 12,
      width: MAP, height: MAP,
      background: 'rgba(255,255,255,0.8)',
      border: '1px solid rgba(0,0,0,0.15)',
      borderRadius: 6, zIndex: 100, overflow: 'hidden',
    }}>
      <div ref={vpRef} style={{
        position: 'absolute',
        background: 'rgba(55,138,221,0.25)',
        border: '1.5px solid rgba(55,138,221,0.8)',
        borderRadius: 2, minWidth: 4, minHeight: 4,
        transition: 'all 0.05s',
      }} />
    </div>
  )
}
