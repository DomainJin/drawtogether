import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'
import { useSocket, getSocket } from '../hooks/useSocket.js'
import WhiteboardCanvas from '../components/WhiteboardCanvas.jsx'
import Toolbar from '../components/Toolbar.jsx'
import CursorOverlay from '../components/CursorOverlay.jsx'
import UserList from '../components/UserList.jsx'

const CANVAS_SIZE = 4000
const SCROLL_THROTTLE = 80

export default function WhiteboardPage() {
  const { roomId } = useParams()
  const { token, room } = useStore()
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
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

  // Scroll về giữa canvas lúc load
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const center = () => {
      vp.scrollLeft = (CANVAS_SIZE - vp.clientWidth) / 2
      vp.scrollTop = (CANVAS_SIZE - vp.clientHeight) / 2
    }
    // Đợi layout xong
    requestAnimationFrame(center)
  }, [])

  // Emit scroll để đồng bộ
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onScroll = () => {
      if (isRemoteScrolling.current) return
      const now = Date.now()
      if (now - lastScrollEmit.current < SCROLL_THROTTLE) return
      lastScrollEmit.current = now
      getSocket()?.emit('viewport:scroll', { x: vp.scrollLeft, y: vp.scrollTop })
    }
    vp.addEventListener('scroll', onScroll, { passive: true })
    return () => vp.removeEventListener('scroll', onScroll)
  }, [])

  useSocket(roomId, canvasRef)

  // Nhận scroll từ remote
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const handle = (e) => {
      const vp = viewportRef.current
      if (!vp) return
      isRemoteScrolling.current = true
      vp.scrollLeft = e.detail.x
      vp.scrollTop = e.detail.y
      setTimeout(() => { isRemoteScrolling.current = false }, 200)
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

  if (!token) return null

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      position: 'fixed', top: 0, left: 0,
      overflow: 'hidden', background: '#e8e8e8',
    }}>

      {/* ── Scrollable viewport ────────────────────────────────────────── */}
      <div
        ref={viewportRef}
        style={{
          position: 'absolute', inset: 0,
          overflow: 'auto',           // 'auto' thay 'scroll' — mobile cần auto
          WebkitOverflowScrolling: 'touch', // iOS momentum scroll
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`
          div::-webkit-scrollbar { display: none; }
        `}</style>

        <div style={{ position: 'relative', width: CANVAS_SIZE, height: CANVAS_SIZE }}>
          <WhiteboardCanvas canvasRef={canvasRef} viewportRef={viewportRef} />
          <CursorOverlay canvasRef={canvasRef} />
        </div>
      </div>

      {/* ── Toggle UI button (luôn hiện) ──────────────────────────────── */}
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
        title={uiVisible ? 'Ẩn toolbar' : 'Hiện toolbar'}
      >
        {uiVisible ? '👁' : '✏️'}
      </button>

      {/* ── UI elements (ẩn/hiện) ─────────────────────────────────────── */}
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
            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {room?.name || roomId}
            </span>
            <button onClick={handleCopyLink} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 5,
              border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
              cursor: 'pointer', color: '#378ADD', whiteSpace: 'nowrap',
            }}>📋 Copy</button>
          </div>

          <UserList />
          <Toolbar onExport={handleExport} />
        </>
      )}

      {/* Mini-map luôn hiện */}
      <MiniMap viewportRef={viewportRef} canvasSize={CANVAS_SIZE} />
    </div>
  )
}

function MiniMap({ viewportRef, canvasSize }) {
  const dotRef = useRef(null)
  const MAP_SIZE = 56

  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const update = () => {
      const dot = dotRef.current
      if (!dot) return
      const vw = vp.clientWidth / canvasSize
      const vh = vp.clientHeight / canvasSize
      const px = (vp.scrollLeft / canvasSize) * MAP_SIZE
      const py = (vp.scrollTop / canvasSize) * MAP_SIZE
      dot.style.left = px + 'px'
      dot.style.top = py + 'px'
      dot.style.width = (vw * MAP_SIZE) + 'px'
      dot.style.height = (vh * MAP_SIZE) + 'px'
    }
    vp.addEventListener('scroll', update, { passive: true })
    update()
    return () => vp.removeEventListener('scroll', update)
  }, [viewportRef, canvasSize])

  // Click minimap để jump
  const onClick = (e) => {
    const vp = viewportRef.current
    const rect = e.currentTarget.getBoundingClientRect()
    const px = (e.clientX - rect.left) / MAP_SIZE
    const py = (e.clientY - rect.top) / MAP_SIZE
    vp.scrollLeft = px * canvasSize - vp.clientWidth / 2
    vp.scrollTop = py * canvasSize - vp.clientHeight / 2
  }

  return (
    <div
      onClick={onClick}
      style={{
        position: 'fixed', bottom: 80, right: 12,
        width: MAP_SIZE, height: MAP_SIZE,
        background: 'rgba(255,255,255,0.85)',
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 6, zIndex: 100,
        overflow: 'hidden', cursor: 'pointer',
      }}
      title="Click để nhảy tới vùng đó"
    >
      <div ref={dotRef} style={{
        position: 'absolute',
        background: 'rgba(55,138,221,0.35)',
        border: '1px solid rgba(55,138,221,0.6)',
        borderRadius: 2,
        minWidth: 4, minHeight: 4,
      }} />
    </div>
  )
}
