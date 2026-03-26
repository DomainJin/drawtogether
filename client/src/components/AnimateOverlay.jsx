import { useEffect, useRef, useState, useCallback } from 'react'

// Physics constants
const FRICTION = 0.98
const BOUNCE = 0.6
const GRAVITY = 0.15
const WOBBLE_SPEED = 0.08

// Mỗi sprite là một object vẽ đã được animate
class Sprite {
  constructor({ id, imageData, x, y, w, h, behavior }) {
    this.id = id
    this.imageData = imageData  // ImageData từ canvas
    this.x = x; this.y = y
    this.w = w; this.h = h
    this.behavior = behavior    // 'swim' | 'drive' | 'bounce' | 'wobble' | 'float' | 'fall'

    // Physics state
    this.vx = (Math.random() - 0.5) * 2
    this.vy = behavior === 'fall' ? 0 : (Math.random() - 0.5) * 2
    this.angle = 0
    this.wobblePhase = Math.random() * Math.PI * 2
    this.flipX = this.vx < 0
    this.age = 0

    // Vẽ imageData ra offscreen canvas để có thể drawImage
    this.offscreen = document.createElement('canvas')
    this.offscreen.width = w
    this.offscreen.height = h
    this.offscreen.getContext('2d').putImageData(imageData, 0, 0)
  }

  update(canvasW, canvasH) {
    this.age++
    this.wobblePhase += WOBBLE_SPEED

    switch (this.behavior) {
      case 'swim':
      case 'drive': {
        // Di chuyển ngang, lắc lư nhẹ
        this.x += this.vx
        this.y += this.vy * 0.3
        this.angle = Math.sin(this.wobblePhase) * (this.behavior === 'swim' ? 0.12 : 0.04)
        // Bounce biên
        if (this.x < 0) { this.x = 0; this.vx *= -1; this.flipX = this.vx < 0 }
        if (this.x + this.w > canvasW) { this.x = canvasW - this.w; this.vx *= -1; this.flipX = this.vx < 0 }
        if (this.y < 0) { this.y = 0; this.vy *= -1 }
        if (this.y + this.h > canvasH) { this.y = canvasH - this.h; this.vy *= -1 }
        break
      }
      case 'bounce': {
        this.vy += GRAVITY
        this.vx *= FRICTION
        this.x += this.vx
        this.y += this.vy
        this.angle = this.vx * 0.05
        if (this.x < 0) { this.x = 0; this.vx = Math.abs(this.vx) * BOUNCE }
        if (this.x + this.w > canvasW) { this.x = canvasW - this.w; this.vx = -Math.abs(this.vx) * BOUNCE }
        if (this.y + this.h > canvasH) {
          this.y = canvasH - this.h
          this.vy = -Math.abs(this.vy) * BOUNCE
          this.vx += (Math.random() - 0.5) * 1.5 // random kick
        }
        if (this.y < 0) { this.y = 0; this.vy = Math.abs(this.vy) * BOUNCE }
        break
      }
      case 'wobble': {
        // Rung lắc tại chỗ
        this.x += Math.sin(this.wobblePhase * 1.3) * 0.8
        this.y += Math.cos(this.wobblePhase * 0.9) * 0.5
        this.angle = Math.sin(this.wobblePhase) * 0.2
        break
      }
      case 'float': {
        // Bay lơ lửng, trôi chậm
        this.x += Math.sin(this.wobblePhase * 0.5) * 0.4 + this.vx * 0.3
        this.y += Math.cos(this.wobblePhase * 0.3) * 0.3 + this.vy * 0.2
        this.angle = Math.sin(this.wobblePhase * 0.7) * 0.1
        // Wrap around edges
        if (this.x < -this.w) this.x = canvasW
        if (this.x > canvasW) this.x = -this.w
        if (this.y < -this.h) this.y = canvasH
        if (this.y > canvasH) this.y = -this.h
        break
      }
      case 'fall': {
        this.vy += GRAVITY * 0.5
        this.y += this.vy
        this.x += Math.sin(this.wobblePhase * 0.5) * 0.5
        this.angle += 0.02
        if (this.y > canvasH + this.h) {
          this.y = -this.h
          this.x = Math.random() * canvasW
          this.vy = 0
        }
        break
      }
    }
  }

  draw(ctx) {
    ctx.save()
    const cx = this.x + this.w / 2
    const cy = this.y + this.h / 2
    ctx.translate(cx, cy)
    ctx.rotate(this.angle)
    if (this.flipX) ctx.scale(-1, 1)
    ctx.drawImage(this.offscreen, -this.w / 2, -this.h / 2, this.w, this.h)
    ctx.restore()
  }
}

// Map từ label AI → behavior
function getBehavior(label) {
  const l = label.toLowerCase()
  if (/fish|whale|shark|dolphin|cá|c[áa]/.test(l)) return 'swim'
  if (/car|truck|bus|vehicle|xe|train|boat|motorcycle/.test(l)) return 'drive'
  if (/ball|balloon|bubble|bóng/.test(l)) return 'bounce'
  if (/bird|butterfly|bee|fly|plane|airplane|dragon|diều/.test(l)) return 'float'
  if (/leaf|snow|rain|star|lá/.test(l)) return 'fall'
  if (/person|human|cat|dog|animal|người|mèo|chó/.test(l)) return 'wobble'
  return 'bounce' // default
}

export default function AnimateOverlay({ canvasRef, camRef, containerRef }) {
  const overlayRef = useRef(null)
  const spritesRef = useRef([])
  const rafRef = useRef(null)
  const [selecting, setSelecting] = useState(false)
  const [selBox, setSelBox] = useState(null)
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const selStart = useRef(null)

  // Animation loop
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    const ctx = overlay.getContext('2d')

    const loop = () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      spritesRef.current.forEach(s => {
        s.update(overlay.width, overlay.height)
        s.draw(ctx)
      })
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    const resize = () => {
      overlay.width = overlay.parentElement.offsetWidth
      overlay.height = overlay.parentElement.offsetHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(overlay.parentElement)
    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [])

  // Chuyển toạ độ màn hình → canvas
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

  // Pointer events cho selection box
  const onSelStart = useCallback((e) => {
    if (!selecting) return
    e.stopPropagation()
    const pos = e.touches ? screenToCanvas(e.touches[0].clientX, e.touches[0].clientY)
                          : screenToCanvas(e.clientX, e.clientY)
    selStart.current = pos
    setSelBox({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }, [selecting, screenToCanvas])

  const onSelMove = useCallback((e) => {
    if (!selecting || !selStart.current) return
    e.stopPropagation()
    const pos = e.touches ? screenToCanvas(e.touches[0].clientX, e.touches[0].clientY)
                          : screenToCanvas(e.clientX, e.clientY)
    setSelBox({
      x: Math.min(pos.x, selStart.current.x),
      y: Math.min(pos.y, selStart.current.y),
      w: Math.abs(pos.x - selStart.current.x),
      h: Math.abs(pos.y - selStart.current.y),
    })
  }, [selecting, screenToCanvas])

  const onSelEnd = useCallback(async (e) => {
    if (!selecting || !selBox || selBox.w < 20 || selBox.h < 20) {
      setSelBox(null)
      selStart.current = null
      return
    }
    e.stopPropagation()
    setSelecting(false)
    await analyzeAndAnimate(selBox)
    setSelBox(null)
    selStart.current = null
  }, [selecting, selBox])

  const analyzeAndAnimate = async (box) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    setStatus('Đang cắt vùng vẽ...')

    try {
      // Cắt vùng được chọn từ canvas
      const { x, y, w, h } = box
      const px = Math.max(0, Math.round(x))
      const py = Math.max(0, Math.round(y))
      const pw = Math.min(Math.round(w), canvas.width - px)
      const ph = Math.min(Math.round(h), canvas.height - py)

      if (pw < 10 || ph < 10) { setLoading(false); return }

      const imageData = canvas.getContext('2d').getImageData(px, py, pw, ph)

      // Chuyển vùng cắt → base64 để gửi API
      const tmp = document.createElement('canvas')
      tmp.width = pw; tmp.height = ph
      tmp.getContext('2d').putImageData(imageData, 0, 0)
      const base64 = tmp.toDataURL('image/png').split(',')[1]

      setStatus('AI đang nhận diện...')

      // Gọi Claude API để nhận diện
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
      const res = await fetch(`${SERVER_URL}/api/animate/identify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64 })
      })
      const data = await res.json()
      const label = data.label || 'object'
      const behavior = getBehavior(label)

      setStatus(`Nhận diện: "${label}" → ${behavior}`)

      // Tạo sprite và thêm vào animation
      const sprite = new Sprite({
        id: Date.now(),
        imageData,
        x: px, y: py,
        w: pw, h: ph,
        behavior,
      })
      spritesRef.current.push(sprite)

      // Xóa vùng đó khỏi canvas tĩnh (vật thể "bước ra")
      const ctx = canvas.getContext('2d')
      ctx.save()
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(px, py, pw, ph)
      ctx.restore()

      setTimeout(() => setStatus(''), 2500)
    } catch (err) {
      setStatus('Lỗi: ' + err.message)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Chuyển tọa độ canvas → màn hình để vẽ selection box
  const canvasToScreen = (cx, cy) => {
    const el = containerRef.current
    if (!el) return { sx: 0, sy: 0 }
    const rect = el.getBoundingClientRect()
    const { x, y, zoom } = camRef.current
    return {
      sx: cx * zoom + x + rect.left,
      sy: cy * zoom + y + rect.top,
    }
  }

  const selScreenBox = selBox ? (() => {
    const tl = canvasToScreen(selBox.x, selBox.y)
    const br = canvasToScreen(selBox.x + selBox.w, selBox.y + selBox.h)
    return { left: tl.sx, top: tl.sy, width: br.sx - tl.sx, height: br.sy - tl.sy }
  })() : null

  return (
    <>
      {/* Overlay canvas cho sprites (fixed, không bị transform) */}
      <canvas
        ref={overlayRef}
        style={{
          position: 'fixed', inset: 0,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      />

      {/* Animate button */}
      <button
        onClick={() => { setSelecting(s => !s); setSelBox(null) }}
        title="Chọn vùng để animate"
        style={{
          position: 'fixed', bottom: 90, left: 58, zIndex: 300,
          height: 34, padding: '0 12px', borderRadius: 8,
          background: selecting ? '#1a1a1a' : 'rgba(255,255,255,0.95)',
          color: selecting ? '#fff' : '#1a1a1a',
          border: `1.5px solid ${selecting ? '#1a1a1a' : 'rgba(0,0,0,0.12)'}`,
          cursor: 'pointer', fontSize: 13, fontWeight: 600,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
        }}
      >
        ✨ {selecting ? 'Đang chọn...' : 'Animate'}
      </button>

      {/* Clear all sprites */}
      {spritesRef.current.length > 0 && (
        <button
          onClick={() => { spritesRef.current = [] }}
          title="Xóa tất cả animation"
          style={{
            position: 'fixed', bottom: 90, left: 170, zIndex: 300,
            height: 34, padding: '0 10px', borderRadius: 8,
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(0,0,0,0.12)',
            cursor: 'pointer', fontSize: 12, color: '#E24B4A',
          }}
        >🗑 Clear</button>
      )}

      {/* Selection capture layer */}
      {selecting && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            cursor: 'crosshair',
          }}
          onMouseDown={onSelStart}
          onMouseMove={onSelMove}
          onMouseUp={onSelEnd}
          onTouchStart={onSelStart}
          onTouchMove={onSelMove}
          onTouchEnd={onSelEnd}
        >
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(0,0,0,0.08)',
          }} />
          {/* Hint */}
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            background: 'rgba(0,0,0,0.7)', color: '#fff',
            padding: '10px 20px', borderRadius: 10,
            fontSize: 14, pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            Kéo để chọn vùng vẽ cần animate
          </div>

          {/* Selection box */}
          {selScreenBox && selScreenBox.width > 5 && (
            <div style={{
              position: 'fixed',
              left: selScreenBox.left, top: selScreenBox.top,
              width: selScreenBox.width, height: selScreenBox.height,
              border: '2px dashed #378ADD',
              background: 'rgba(55,138,221,0.08)',
              borderRadius: 4,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      )}

      {/* Loading/status */}
      {(loading || status) && (
        <div style={{
          position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)', color: '#fff',
          padding: '8px 18px', borderRadius: 20,
          fontSize: 13, zIndex: 400, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {loading && <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span>}
          {status}
        </div>
      )}
    </>
  )
}
