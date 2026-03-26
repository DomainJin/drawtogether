import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'
import { useSocket, getSocket } from '../hooks/useSocket.js'
import WhiteboardCanvas from '../components/WhiteboardCanvas.jsx'
import Toolbar from '../components/Toolbar.jsx'
import CursorOverlay from '../components/CursorOverlay.jsx'
import UserList from '../components/UserList.jsx'

const CANVAS_SIZE = 4000
const MIN_ZOOM = 0.1
const MAX_ZOOM = 5
const SCROLL_THROTTLE = 80

export default function WhiteboardPage() {
  const { roomId } = useParams()
  const { token, room } = useStore()
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const zoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const navigate = useNavigate()
  const lastScrollEmit = useRef(0)
  const isRemoteScrolling = useRef(false)
  const [uiVisible, setUiVisible] = useState(true)

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

  // Scroll về giữa lúc load
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    requestAnimationFrame(() => {
      vp.scrollLeft = (CANVAS_SIZE - vp.clientWidth) / 2
      vp.scrollTop = (CANVAS_SIZE - vp.clientHeight) / 2
    })
  }, [])

  // Xử lý zoom từ canvas (pinch gesture)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const handle = (e) => {
      const { zoom: newZoom, pivotX, pivotY, oldZoom } = e.detail
      // Giữ điểm pivot cố định khi zoom
      const scrollX = (vp.scrollLeft + pivotX) * (newZoom / oldZoom) - pivotX
      const scrollY = (vp.scrollTop + pivotY) * (newZoom / oldZoom) - pivotY
      zoomRef.current = newZoom
      setZoom(newZoom)
      requestAnimationFrame(() => {
        vp.scrollLeft = scrollX
        vp.scrollTop = scrollY
      })
    }
    vp.addEventListener('zoom:change', handle)
    return () => vp.removeEventListener('zoom:change', handle)
  }, [])

  // Wheel zoom (PC: Ctrl + scroll)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = vp.getBoundingClientRect()
      const pivotX = e.clientX - rect.left
      const pivotY = e.clientY - rect.top
      const oldZoom = zoomRef.current
      const delta = e.deltaY < 0 ? 1.1 : 0.9
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * delta))
      const scrollX = (vp.scrollLeft + pivotX) * (newZoom / oldZoom) - pivotX
      const scrollY = (vp.scrollTop + pivotY) * (newZoom / oldZoom) - pivotY
      zoomRef.current = newZoom
      setZoom(newZoom)
      requestAnimationFrame(() => {
        vp.scrollLeft = scrollX
        vp.scrollTop = scrollY
      })
    }
    vp.addEventListener('wheel', onWheel, { passive: false })
    return () => vp.removeEventListener('wheel', onWheel)
  }, [])

  // Emit scroll
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onScroll = () => {
      if (isRemoteScrolling.current) return
      const now = Date.now()
      if (now - lastScrollEmit.current < SCROLL_THROTTLE) return
      lastScrollEmit.current = now
      getSocket()?.emit('viewport:scroll', { x: vp.scrollLeft, y: vp.scrollTop, zoom: zoomRef.current })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => vp.removeEventListener('scroll', onScroll)
  }, [])

  useSocket(roomId, canvasRef)

  // Nhận scroll/zoom từ remote
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = (e) => {
      const vp = viewportRef.current
      if (!vp) return
      isRemoteScrolling.current = true
      if (e.detail.zoom !== undefined && e.detail.zoom !== zoomRef.current) {
        zoomRef.current = e.detail.zoom
        setZoom(e.detail.zoom)
      }
      requestAnimationFrame(() => {
        vp.scrollLeft = e.detail.x
        vp.scrollTop = e.detail.y
        setTimeout(() => { isRemoteScrolling.current = false }, 200)
      })
    }
    canvas.addEventListener('remote:scroll', handle)
    return () => canvas.removeEventListener('remote:scroll', handle)
  }, [])

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `whiteboard-${roomId}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    alert('Đã copy link!')
  }

  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoomRef.current * 1.25)
    applyZoom(newZoom)
  }
  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoomRef.current / 1.25)
    applyZoom(newZoom)
  }
  const handleZoomReset = () => applyZoom(1)

  const applyZoom = useCallback((newZoom) => {
    const vp = viewportRef.current
    if (!vp) return
    const pivotX = vp.clientWidth / 2
    const pivotY = vp.clientHeight / 2
    const oldZoom = zoomRef.current
    const scrollX = (vp.scrollLeft + pivotX) * (newZoom / oldZoom) - pivotX
    const scrollY = (vp.scrollTop + pivotY) * (newZoom / oldZoom) - pivotY
    zoomRef.current = newZoom
    setZoom(newZoom)
    requestAnimationFrame(() => {
      vp.scrollLeft = scrollX
      vp.scrollTop = scrollY
    })
  }, [])

  if (!token) return null

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      position: 'fixed', top: 0, left: 0,
      overflow: 'hidden', background: '#d0d0d0',
    }}>
      {/* Scrollable viewport */}
      <div
        ref={viewportRef}
        style={{
          position: 'absolute', inset: 0,
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`div::-webkit-scrollbar{display:none}`}</style>

        {/* Container scaled theo zoom */}
        <div style={{
          position: 'relative',
          width: CANVAS_SIZE * zoom,
          height: CANVAS_SIZE * zoom,
        }}>
          <div style={{
            transform: `scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute', top: 0, left: 0,
          }}>
            <WhiteboardCanvas canvasRef={canvasRef} viewportRef={viewportRef} zoomRef={zoomRef} />
            <CursorOverlay canvasRef={canvasRef} />
          </div>
        </div>
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >{uiVisible ? '👁' : '✏️'}</button>

      {uiVisible && (
        <>
          {/* Header */}
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
            <button onClick={handleCopyLink} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 5,
              border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
              cursor: 'pointer', color: '#378ADD',
            }}>📋 Copy</button>
          </div>

          {/* Zoom controls */}
          <div style={{
            position: 'fixed', bottom: 90, left: 16, zIndex: 200,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <ZoomBtn onClick={handleZoomIn}>+</ZoomBtn>
            <div style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: 6, padding: '4px 6px',
              fontSize: 11, fontWeight: 600, textAlign: 'center',
              cursor: 'pointer', userSelect: 'none',
            }} onClick={handleZoomReset}>
              {Math.round(zoom * 100)}%
            </div>
            <ZoomBtn onClick={handleZoomOut}>−</ZoomBtn>
          </div>

          <UserList />
          <Toolbar onExport={handleExport} />
        </>
      )}

      <MiniMap viewportRef={viewportRef} canvasSize={CANVAS_SIZE} zoom={zoom} />
    </div>
  )
}

function ZoomBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: 32, height: 32, borderRadius: 6,
      background: 'rgba(255,255,255,0.95)',
      border: '1px solid rgba(0,0,0,0.1)',
      fontSize: 18, fontWeight: 500, cursor: 'pointer',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  )
}

function MiniMap({ viewportRef, canvasSize, zoom }) {
  const dotRef = useRef(null)
  const MAP = 60

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const update = () => {
      const dot = dotRef.current
      if (!dot) return
      const totalW = canvasSize * zoom
      const totalH = canvasSize * zoom
      const vw = (vp.clientWidth / totalW) * MAP
      const vh = (vp.clientHeight / totalH) * MAP
      const px = (vp.scrollLeft / totalW) * MAP
      const py = (vp.scrollTop / totalH) * MAP
      dot.style.left = px + 'px'
      dot.style.top = py + 'px'
      dot.style.width = Math.min(vw, MAP) + 'px'
      dot.style.height = Math.min(vh, MAP) + 'px'
    }
    vp.addEventListener('scroll', update, { passive: true })
    update()
    return () => vp.removeEventListener('scroll', update)
  }, [viewportRef, canvasSize, zoom])

  const onClick = (e) => {
    const vp = viewportRef.current
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / MAP
    const py = (e.clientY - rect.top) / MAP
    vp.scrollLeft = px * canvasSize * zoom - vp.clientWidth / 2
    vp.scrollTop = py * canvasSize * zoom - vp.clientHeight / 2
  }

  return (
    <div onClick={onClick} style={{
      position: 'fixed', bottom: 90, right: 12,
      width: MAP, height: MAP,
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(0,0,0,0.12)',
      borderRadius: 6, zIndex: 100, overflow: 'hidden', cursor: 'pointer',
    }}>
      <div ref={dotRef} style={{
        position: 'absolute',
        background: 'rgba(55,138,221,0.3)',
        border: '1px solid rgba(55,138,221,0.7)',
        borderRadius: 2, minWidth: 4, minHeight: 4,
      }} />
    </div>
  )
}
