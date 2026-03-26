import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store/index.js'
import { useSocket } from '../hooks/useSocket.js'
import WhiteboardCanvas from '../components/WhiteboardCanvas.jsx'
import Toolbar from '../components/Toolbar.jsx'
import CursorOverlay from '../components/CursorOverlay.jsx'
import UserList from '../components/UserList.jsx'
import { getSocket } from '../hooks/useSocket.js'

const SCROLL_THROTTLE = 100

export default function WhiteboardPage() {
  const { roomId } = useParams()
  const { token, room } = useStore()
  const canvasRef = useRef(null)
  const viewportRef = useRef(null)
  const navigate = useNavigate()
  const lastScrollEmit = useRef(0)
  const isRemoteScrolling = useRef(false)

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
    const vp = viewportRef.current
    if (!vp) return
    // Center scroll
    vp.scrollLeft = (4000 - window.innerWidth) / 2
    vp.scrollTop = (4000 - window.innerHeight) / 2
  }, [])

  // Emit scroll position để đồng bộ với người khác
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const onScroll = () => {
      if (isRemoteScrolling.current) return
      const now = Date.now()
      if (now - lastScrollEmit.current < SCROLL_THROTTLE) return
      lastScrollEmit.current = now
      getSocket()?.emit('viewport:scroll', {
        x: vp.scrollLeft,
        y: vp.scrollTop,
      })
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
    alert('Đã copy link! Gửi cho bạn bè để vẽ cùng.')
  }

  if (!token) return null

  return (
    <div style={{
      width: '100vw', height: '100dvh',
      position: 'fixed', top: 0, left: 0,
      overflow: 'hidden', background: '#e8e8e8',
    }}>
      {/* Header */}
      <div style={{
        position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
        border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12,
        padding: '8px 16px', zIndex: 200,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 18 }}>🎨</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{room?.name || roomId}</span>
        <button onClick={handleCopyLink} style={{
          fontSize: 12, padding: '4px 10px', borderRadius: 6,
          border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
          cursor: 'pointer', color: '#378ADD',
        }}>📋 Copy link</button>
      </div>

      {/* Scrollable viewport — đây là "cửa sổ" nhìn vào canvas lớn */}
      <div
        ref={viewportRef}
        style={{
          position: 'absolute', inset: 0,
          overflow: 'scroll',
          // Ẩn scrollbar nhưng vẫn scroll được
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>

        {/* Canvas layer */}
        <div style={{ position: 'relative', width: 4000, height: 4000 }}>
          <WhiteboardCanvas canvasRef={canvasRef} viewportRef={viewportRef} />
          <CursorOverlay canvasRef={canvasRef} viewportRef={viewportRef} />
        </div>
      </div>

      {/* Mini-map indicator (tuỳ chọn) */}
      <ScrollIndicator viewportRef={viewportRef} />

      <UserList />
      <Toolbar onExport={handleExport} />
    </div>
  )
}

// Chấm nhỏ góc phải dưới cho biết đang ở đâu trên canvas
function ScrollIndicator({ viewportRef }) {
  const dotRef = useRef(null)
  useEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const update = () => {
      const dot = dotRef.current
      if (!dot) return
      const px = (vp.scrollLeft / 4000) * 100
      const py = (vp.scrollTop / 4000) * 100
      dot.style.left = px + '%'
      dot.style.top = py + '%'
    }
    vp.addEventListener('scroll', update, { passive: true })
    update()
    return () => vp.removeEventListener('scroll', update)
  }, [viewportRef])

  return (
    <div style={{
      position: 'fixed', bottom: 90, right: 16,
      width: 60, height: 60,
      background: 'rgba(255,255,255,0.8)',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: 8, zIndex: 100,
      overflow: 'hidden',
    }}>
      <div ref={dotRef} style={{
        position: 'absolute',
        width: '25%', height: '25%',
        background: 'rgba(55,138,221,0.4)',
        borderRadius: 2,
        transition: 'left 0.1s, top 0.1s',
      }} />
    </div>
  )
}
