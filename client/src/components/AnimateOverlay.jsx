import { useEffect, useRef, useState, useCallback } from 'react'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

// ── Behavior map ──────────────────────────────────────────────────────────────
function getBehavior(label) {
  const l = (label || '').toLowerCase()
  if (/fish|whale|shark|dolphin|cá|seal|octopus/.test(l)) return 'swim'
  if (/car|truck|bus|vehicle|xe|train|motorcycle|bike|tank/.test(l)) return 'drive'
  if (/bird|butterfly|bee|fly|plane|airplane|dragon|kite|ufo|rocket/.test(l)) return 'fly'
  if (/ball|balloon|bubble|bóng/.test(l)) return 'bounce'
  if (/leaf|snow|rain|star|petal/.test(l)) return 'fall'
  return 'roam' // default: di chuyển tự do
}

// ── Sprite class — SVG-based, physics tự do ───────────────────────────────────
class Sprite {
  constructor({ id, svgString, pixelImageData, x, y, w, h, behavior, label }) {
    this.id = id
    this.label = label
    this.behavior = behavior
    this.w = w; this.h = h
    this.x = x; this.y = y

    // Vận tốc ban đầu random — đủ mạnh để di chuyển rõ
    const speed = behavior === 'drive' || behavior === 'swim' ? 2.5
                : behavior === 'fly' ? 2
                : behavior === 'bounce' ? 3.5 : 2
    const angle = Math.random() * Math.PI * 2
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed

    this.angle = 0          // rotation hiển thị
    this.wobble = Math.random() * Math.PI * 2
    this.wobbleAmp = 0

    // Tạo Image từ SVG string hoặc fallback pixel
    this.img = new Image()
    this.ready = false

    if (svgString) {
      // SVG → blob URL
      const blob = new Blob([svgString], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      this.img.onload = () => { this.ready = true; URL.revokeObjectURL(url) }
      this.img.src = url
    } else if (pixelImageData) {
      // Fallback: pixel ImageData
      const tmp = document.createElement('canvas')
      tmp.width = w; tmp.height = h
      tmp.getContext('2d').putImageData(pixelImageData, 0, 0)
      this.img.onload = () => { this.ready = true }
      this.img.src = tmp.toDataURL()
    }
  }

  update(W, H) {
    this.wobble += 0.06

    switch (this.behavior) {

      case 'swim': {
        this.wobbleAmp = 0.12
        this.x += this.vx
        this.y += this.vy * 0.4
        // Thỉnh thoảng đổi hướng y
        if (Math.random() < 0.008) this.vy = (Math.random() - 0.5) * 2
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble) * this.wobbleAmp
        break
      }

      case 'drive': {
        this.wobbleAmp = 0.03
        // Xe chỉ di chuyển ngang, lăn bánh nhẹ
        this.x += this.vx
        // Thỉnh thoảng nhảy lên nhỏ
        if (Math.random() < 0.005) this.vy = -2
        this.vy += 0.1 // gravity nhẹ
        this.y += this.vy
        if (this.y + this.h > H) { this.y = H - this.h; this.vy = 0 }
        if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.5 }
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx); }
        if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) }
        this.angle = Math.sin(this.wobble * 0.5) * this.wobbleAmp
        break
      }

      case 'fly': {
        this.wobbleAmp = 0.15
        this.x += this.vx
        this.y += this.vy
        // Random turbulence
        this.vx += (Math.random() - 0.5) * 0.15
        this.vy += (Math.random() - 0.5) * 0.15
        // Clamp speed
        const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
        if (spd > 3.5) { this.vx = this.vx/spd*3.5; this.vy = this.vy/spd*3.5 }
        if (spd < 1)   { this.vx *= 1.5; this.vy *= 1.5 }
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble) * this.wobbleAmp
        break
      }

      case 'bounce': {
        // Full gravity + bounce
        this.vy += 0.25
        this.x += this.vx
        this.y += this.vy
        this.angle = this.vx * 0.04
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) * 0.85 }
        if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) * 0.85 }
        if (this.y + this.h > H) {
          this.y = H - this.h
          this.vy = -Math.abs(this.vy) * 0.75
          this.vx += (Math.random() - 0.5) * 1.5
        }
        if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * 0.75 }
        break
      }

      case 'fall': {
        this.vy += 0.08
        this.x += Math.sin(this.wobble * 0.5) * 0.6 + this.vx * 0.2
        this.y += this.vy
        this.angle += 0.015
        if (this.y > H + this.h) {
          this.y = -this.h
          this.x = Math.random() * W
          this.vy = 0.5 + Math.random() * 1.5
        }
        break
      }

      default: // 'roam' — di chuyển tự do random
      {
        this.x += this.vx
        this.y += this.vy
        // Dần đổi hướng nhẹ
        this.vx += (Math.random() - 0.5) * 0.12
        this.vy += (Math.random() - 0.5) * 0.12
        const spd = Math.sqrt(this.vx*this.vx + this.vy*this.vy)
        if (spd > 3) { this.vx = this.vx/spd*3; this.vy = this.vy/spd*3 }
        if (spd < 0.8) { this.vx *= 1.3; this.vy *= 1.3 }
        this._bounceWalls(W, H)
        this.angle = Math.sin(this.wobble * 0.7) * 0.08
        break
      }
    }
  }

  _bounceWalls(W, H) {
    if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) }
    if (this.x + this.w > W) { this.x = W - this.w; this.vx = -Math.abs(this.vx) }
    if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) }
    if (this.y + this.h > H) { this.y = H - this.h; this.vy = -Math.abs(this.vy) }
  }

  draw(ctx) {
    if (!this.ready) return
    ctx.save()
    const cx = this.x + this.w / 2
    const cy = this.y + this.h / 2
    ctx.translate(cx, cy)
    ctx.rotate(this.angle)
    // Lật theo hướng đi
    if (this.vx < -0.1) ctx.scale(-1, 1)
    ctx.drawImage(this.img, -this.w / 2, -this.h / 2, this.w, this.h)
    ctx.restore()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AnimateOverlay({ canvasRef, camRef, containerRef }) {
  const overlayRef = useRef(null)
  const spritesRef = useRef([])
  const rafRef = useRef(null)
  const [selecting, setSelecting] = useState(false)
  const [selBox, setSelBox] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const selStart = useRef(null)
  const [spriteCount, setSpriteCount] = useState(0)

  // Animation loop
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')

    const resize = () => {
      overlay.width = window.innerWidth
      overlay.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      spritesRef.current.forEach(s => {
        s.update(overlay.width, overlay.height)
        s.draw(ctx)
      })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  // Screen → canvas coords
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

  const onSelStart = useCallback((e) => {
    if (!selecting) return
    e.stopPropagation(); e.preventDefault()
    const cl = e.touches ? e.touches[0] : e
    const pos = screenToCanvas(cl.clientX, cl.clientY)
    selStart.current = pos
    setSelBox({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }, [selecting, screenToCanvas])

  const onSelMove = useCallback((e) => {
    if (!selecting || !selStart.current) return
    e.stopPropagation(); e.preventDefault()
    const cl = e.touches ? e.touches[0] : e
    const pos = screenToCanvas(cl.clientX, cl.clientY)
    setSelBox({
      x: Math.min(pos.x, selStart.current.x),
      y: Math.min(pos.y, selStart.current.y),
      w: Math.abs(pos.x - selStart.current.x),
      h: Math.abs(pos.y - selStart.current.y),
    })
  }, [selecting, screenToCanvas])

  const onSelEnd = useCallback(async (e) => {
    if (!selecting || !selBox || selBox.w < 20 || selBox.h < 20) {
      setSelBox(null); selStart.current = null; return
    }
    e.stopPropagation()
    setSelecting(false)
    await analyzeAndAnimate(selBox)
    setSelBox(null); selStart.current = null
  }, [selecting, selBox])

  const analyzeAndAnimate = async (box) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    setStatus('Đang cắt vùng...')

    try {
      const px = Math.max(0, Math.round(box.x))
      const py = Math.max(0, Math.round(box.y))
      const pw = Math.min(Math.round(box.w), canvas.width - px)
      const ph = Math.min(Math.round(box.h), canvas.height - py)
      if (pw < 10 || ph < 10) { setLoading(false); return }

      // Lấy pixel data để gửi AI
      const imageData = canvas.getContext('2d').getImageData(px, py, pw, ph)
      const tmp = document.createElement('canvas')
      tmp.width = pw; tmp.height = ph
      tmp.getContext('2d').putImageData(imageData, 0, 0)
      const base64 = tmp.toDataURL('image/png').split(',')[1]

      setStatus('AI đang nhận diện và vẽ lại...')

      const res = await fetch(`${SERVER_URL}/api/animate/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })
      const data = await res.json()

      const label = data.label || 'object'
      const behavior = data.behavior || getBehavior(label)
      const svgString = data.svg || null

      setStatus(`"${label}" → ${behavior} ✨`)

      // Kích thước sprite trên màn hình
      const zoom = camRef.current.zoom
      const dispW = pw * zoom
      const dispH = ph * zoom

      // Scale lên cho dễ thấy (min 80px)
      const scale = Math.max(1, 80 / Math.min(dispW, dispH))
      const spriteW = dispW * scale
      const spriteH = dispH * scale

      // Vị trí ban đầu: ở giữa màn hình
      const startX = window.innerWidth / 2 - spriteW / 2
      const startY = window.innerHeight / 2 - spriteH / 2

      const sprite = new Sprite({
        id: Date.now(),
        svgString,
        pixelImageData: svgString ? null : imageData,
        x: startX, y: startY,
        w: spriteW, h: spriteH,
        behavior, label,
      })
      spritesRef.current.push(sprite)
      setSpriteCount(c => c + 1)

      // Xóa vùng khỏi canvas tĩnh
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(px, py, pw, ph)

      setTimeout(() => setStatus(''), 3000)
    } catch (err) {
      setStatus('Lỗi: ' + err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Canvas coords → screen coords để vẽ selection box UI
  const toScreen = (cx, cy) => {
    const el = containerRef.current
    if (!el) return { sx: 0, sy: 0 }
    const rect = el.getBoundingClientRect()
    const { x, y, zoom } = camRef.current
    return { sx: cx * zoom + x + rect.left, sy: cy * zoom + y + rect.top }
  }

  const selScreen = selBox ? (() => {
    const tl = toScreen(selBox.x, selBox.y)
    const br = toScreen(selBox.x + selBox.w, selBox.y + selBox.h)
    return { left: tl.sx, top: tl.sy, width: br.sx - tl.sx, height: br.sy - tl.sy }
  })() : null

  return (
    <>
      {/* Sprite animation canvas — fixed, toàn màn hình */}
      <canvas ref={overlayRef} style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50,
      }} />

      {/* Animate button */}
      <button
        onClick={() => { setSelecting(s => !s); setSelBox(null) }}
        style={{
          position: 'fixed', bottom: 90, left: 58, zIndex: 300,
          height: 34, padding: '0 12px', borderRadius: 8,
          background: selecting ? '#1a1a1a' : 'rgba(255,255,255,0.95)',
          color: selecting ? '#fff' : '#1a1a1a',
          border: `1.5px solid ${selecting ? '#1a1a1a' : 'rgba(0,0,0,0.15)'}`,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          transition: 'all 0.15s',
        }}
      >✨ {selecting ? 'Kéo chọn...' : 'Animate'}</button>

      {spriteCount > 0 && (
        <button
          onClick={() => { spritesRef.current = []; setSpriteCount(0) }}
          style={{
            position: 'fixed', bottom: 90, left: 174, zIndex: 300,
            height: 34, padding: '0 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(0,0,0,0.12)',
            cursor: 'pointer', fontSize: 12, color: '#E24B4A',
          }}
        >🗑 {spriteCount}</button>
      )}

      {/* Selection overlay */}
      {selecting && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 250, cursor: 'crosshair' }}
          onMouseDown={onSelStart} onMouseMove={onSelMove} onMouseUp={onSelEnd}
          onTouchStart={onSelStart} onTouchMove={onSelMove} onTouchEnd={onSelEnd}
        >
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.1)' }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(0,0,0,0.75)', color: '#fff',
            padding: '10px 20px', borderRadius: 12,
            fontSize: 14, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            ✏️ Kéo để bao quanh hình vẽ → AI vẽ lại + animate
          </div>
          {selScreen && selScreen.width > 5 && (
            <div style={{
              position: 'fixed',
              left: selScreen.left, top: selScreen.top,
              width: selScreen.width, height: selScreen.height,
              border: '2px dashed #378ADD',
              background: 'rgba(55,138,221,0.1)',
              borderRadius: 4, pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      {/* Status toast */}
      {(loading || status) && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.82)', color: '#fff',
          padding: '8px 20px', borderRadius: 20,
          fontSize: 13, zIndex: 400,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
          {loading && <span style={{
            display: 'inline-block',
            animation: 'rotate 1s linear infinite',
          }}>⚙️</span>}
          {status}
          <style>{`@keyframes rotate { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </>
  )
}
