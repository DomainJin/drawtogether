import { useEffect, useRef, useState, useCallback } from 'react'
import { getSocket } from '../hooks/useSocket.js'
import { ANIMATE_CONFIG as CFG, ANIMATE_UI as UI } from '../animate/config.js'
import { getBehavior, pickRawBehavior } from '../animate/behavior.js'
import { extractRawTexture, textureScale } from '../animate/rawSprite.js'
import { computeSpriteBox } from '../animate/layout.js'
import { Sprite } from '../animate/sprite.js'

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

/** Nhớ lựa chọn bật/tắt AI giữa các phiên: người dùng tắt AI thường vì mạng
 *  chậm hoặc hết quota, tình trạng đó không tự hết sau khi F5. */
function loadAiPref() {
  try {
    const v = localStorage.getItem(CFG.AI_RENDER_STORAGE_KEY)
    return v === null ? true : v === '1'
  } catch { return true }
}

/** Texture raw → PNG data URL, thu nhỏ nếu vượt trần.
 *  Data URL chứ không phải ImageData: sprite còn phải đi qua socket cho máy
 *  khác dựng lại, mà ImageData thì không serialize được. */
function rawTextureToDataUrl(imageData) {
  const tex = extractRawTexture(imageData)
  if (!tex) return null

  const src = document.createElement('canvas')
  src.width = tex.width; src.height = tex.height
  src.getContext('2d').putImageData(new ImageData(tex.data, tex.width, tex.height), 0, 0)

  const k = textureScale(tex.width, tex.height)
  if (k === 1) return { url: src.toDataURL('image/png'), width: tex.width, height: tex.height }

  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(tex.width * k))
  out.height = Math.max(1, Math.round(tex.height * k))
  const octx = out.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(src, 0, 0, out.width, out.height)
  return { url: out.toDataURL('image/png'), width: tex.width, height: tex.height }
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
  const [aiRender, setAiRender] = useState(loadAiPref)

  // analyzeAndAnimate chạy sau một chuỗi await; đọc state qua ref để lấy đúng
  // lựa chọn tại thời điểm thả chuột, và để listener không phải dựng lại.
  const aiRenderRef = useRef(aiRender)
  useEffect(() => {
    aiRenderRef.current = aiRender
    try { localStorage.setItem(CFG.AI_RENDER_STORAGE_KEY, aiRender ? '1' : '0') } catch {}
  }, [aiRender])

  // Lắng nghe sprite từ socket và canvas event
  useEffect(() => {
    const addSprite = (data) => {
      const { svgString, imageUrl, x, y, w, h, behavior, label, id } = data
      if (spritesRef.current.find(s => s.id === id)) return
      const sprite = new Sprite({ id, svgString, imageUrl, x, y, w, h, behavior, label })
      spritesRef.current.push(sprite)
      setSpriteCount(c => c + 1)
    }

    const clearSprites = () => {
      spritesRef.current = []
      setSpriteCount(0)
    }

    // Canvas events (history khi join phòng)
    const canvas = canvasRef.current
    const handleHistoryAdd = (e) => addSprite(e.detail)
    canvas?.addEventListener('remote:sprite:add', handleHistoryAdd)

    // Attach socket listeners — dùng named ref để không duplicate
    let attached = false
    let attachedSocket = null

    const tryAttach = () => {
      const s = getSocket()
      if (!s || attached) return
      attached = true
      attachedSocket = s
      s.on('sprite:add', addSprite)
      s.on('sprite:clear', clearSprites)
      clearInterval(interval)
    }

    tryAttach()
    const interval = setInterval(tryAttach, 300)

    return () => {
      clearInterval(interval)
      if (attachedSocket) {
        attachedSocket.off('sprite:add', addSprite)
        attachedSocket.off('sprite:clear', clearSprites)
      }
      canvas?.removeEventListener('remote:sprite:add', handleHistoryAdd)
    }
  }, [canvasRef])

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
    const min = CFG.MIN_SELECTION_PX
    if (!selecting || !selBox || selBox.w < min || selBox.h < min) {
      setSelBox(null); selStart.current = null; return
    }
    e.stopPropagation()
    setSelecting(false)
    await analyzeAndAnimate(selBox)
    setSelBox(null); selStart.current = null
  }, [selecting, selBox])

  /** Hỏi AI nhận diện + vẽ lại. Trả null khi hỏng — null nghĩa là rơi về sprite
   *  raw, không bỏ luôn thao tác của người dùng. */
  const askAi = async (base64) => {
    setStatus('AI đang nhận diện... (có thể mất 10-30s)')
    const res = await fetch(`${SERVER_URL}/api/animate/identify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64 })
    })
    const rawText = await res.text()
    let data
    try {
      data = JSON.parse(rawText)
    } catch (e) {
      console.error('[Animate] JSON parse error:', e, rawText)
      setStatus('AI trả về không hợp lệ — dùng sprite raw')
      return null
    }
    if (data.error) {
      console.error('[Animate] server error:', data.error)
      setStatus('AI lỗi, dùng sprite raw: ' + data.error)
      return null
    }
    const label = data.label || 'object'
    return { svgString: data.svg || null, label, behavior: data.behavior || getBehavior(label) }
  }

  const analyzeAndAnimate = async (box) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const useAi = aiRenderRef.current
    setLoading(true)
    setStatus('Đang cắt vùng...')

    try {
      const px = Math.max(0, Math.round(box.x))
      const py = Math.max(0, Math.round(box.y))
      const pw = Math.min(Math.round(box.w), canvas.width - px)
      const ph = Math.min(Math.round(box.h), canvas.height - py)
      if (pw < CFG.MIN_CROP_PX || ph < CFG.MIN_CROP_PX) { setLoading(false); return }

      const imageData = canvas.getContext('2d', { willReadFrequently: true }).getImageData(px, py, pw, ph)

      // Texture raw luôn được dựng: vừa là nội dung khi tắt AI, vừa là lưới an
      // toàn khi AI hỏng hoặc không trả về SVG.
      const raw = rawTextureToDataUrl(imageData)
      if (!raw) {
        setStatus('Vùng chọn trống — chưa có nét nào')
        setLoading(false)
        setTimeout(() => setStatus(''), 2500)
        return
      }

      let svgString = null
      let label = 'sprite raw'
      let behavior = pickRawBehavior()

      if (useAi) {
        const tmp = document.createElement('canvas')
        tmp.width = pw; tmp.height = ph
        tmp.getContext('2d').putImageData(imageData, 0, 0)
        const base64 = tmp.toDataURL('image/png').split(',')[1]
        const ai = await askAi(base64)
        if (ai) {
          label = ai.label
          behavior = ai.behavior
          svgString = ai.svgString
          setStatus(`"${label}" → ${behavior} ✨`)
        }
      } else {
        setStatus(`Sprite raw → ${behavior} 🪁`)
      }

      // Tỉ lệ lấy từ texture đã cắt sát mực, không phải từ khung người dùng
      // kéo: kéo rộng tay thì sprite mang theo lề trắng và va tường bằng
      // khoảng không. Với SVG do AI vẽ lại thì khung gốc mới đúng tỉ lệ.
      const srcW = svgString ? pw : raw.width
      const srcH = svgString ? ph : raw.height
      const spriteBox = computeSpriteBox({
        cropW: srcW, cropH: srcH,
        zoom: camRef.current.zoom,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
      })

      const payload = {
        id: Date.now(),
        svgString,
        imageUrl: svgString ? null : raw.url,
        x: spriteBox.x, y: spriteBox.y,
        w: spriteBox.w, h: spriteBox.h,
        behavior, label,
      }

      // Emit lên server — server broadcast lại cho TẤT CẢ kể cả mình
      const socket = getSocket()
      if (socket && socket.connected) {
        socket.emit('sprite:add', payload)
      } else {
        // Fallback: add local nếu không có socket
        console.warn('[Animate] no socket, adding locally')
        spritesRef.current.push(new Sprite(payload))
        setSpriteCount(c => c + 1)
      }

      // Xóa vùng khỏi canvas tĩnh
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
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

  const btnBase = {
    position: 'fixed', bottom: UI.BOTTOM_PX, zIndex: UI.Z_BUTTONS,
    height: UI.BTN_HEIGHT_PX, borderRadius: 8,
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    transition: 'all 0.15s',
  }

  return (
    <>
      {/* Sprite animation canvas — fixed, toàn màn hình */}
      <canvas ref={overlayRef} style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: UI.Z_SPRITE_LAYER,
      }} />

      {/* Animate button */}
      <button
        onClick={() => { setSelecting(s => !s); setSelBox(null) }}
        style={{
          ...btnBase,
          left: UI.ANIMATE_LEFT_PX, width: UI.ANIMATE_WIDTH_PX,
          background: selecting ? '#1a1a1a' : 'rgba(255,255,255,0.95)',
          color: selecting ? '#fff' : '#1a1a1a',
          border: `1.5px solid ${selecting ? '#1a1a1a' : 'rgba(0,0,0,0.15)'}`,
        }}
      >✨ {selecting ? 'Kéo chọn...' : 'Animate'}</button>

      {/* Toggle AI render — tắt thì bỏ hẳn vòng gọi AI, hình vẽ bay lượn
          nguyên nét tay. Nhanh, không cần mạng, giữ đúng nét người vẽ. */}
      <button
        onClick={() => setAiRender(v => !v)}
        title={aiRender
          ? 'AI đang BẬT — AI nhận diện và vẽ lại hình trước khi cho bay'
          : 'AI đang TẮT — hình vẽ bay lượn nguyên nét tay (sprite raw)'}
        style={{
          ...btnBase,
          left: UI.AI_TOGGLE_LEFT_PX, width: UI.AI_TOGGLE_WIDTH_PX,
          gap: 5, fontSize: 12,
          background: aiRender ? 'rgba(55,138,221,0.12)' : 'rgba(255,255,255,0.95)',
          color: aiRender ? '#1F6FB8' : '#8A8A8A',
          border: `1.5px solid ${aiRender ? '#378ADD' : 'rgba(0,0,0,0.15)'}`,
        }}
      >
        <span style={{
          width: 26, height: 14, borderRadius: 7, flexShrink: 0,
          background: aiRender ? '#378ADD' : 'rgba(0,0,0,0.22)',
          position: 'relative', transition: 'background 0.15s',
        }}>
          <span style={{
            position: 'absolute', top: 2, left: aiRender ? 14 : 2,
            width: 10, height: 10, borderRadius: '50%', background: '#fff',
            transition: 'left 0.15s',
          }} />
        </span>
        AI
      </button>

      {spriteCount > 0 && (
        <button
          onClick={() => {
          const socket = getSocket()
          if (socket && socket.connected) {
            socket.emit('sprite:clear') // server sẽ broadcast clear cho tất cả
          } else {
            // fallback local
            spritesRef.current = []
            setSpriteCount(0)
          }
        }}
          style={{
            ...btnBase,
            left: UI.CLEAR_LEFT_PX, padding: '0 10px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid rgba(0,0,0,0.12)',
            fontSize: 12, fontWeight: 500, color: '#E24B4A',
          }}
        >🗑 {spriteCount}</button>
      )}

      {/* Selection overlay */}
      {selecting && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: UI.Z_SELECTION, cursor: 'crosshair' }}
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
            {aiRender
              ? '✏️ Kéo để bao quanh hình vẽ → AI vẽ lại + animate'
              : '✏️ Kéo để bao quanh hình vẽ → bay lượn nguyên nét tay'}
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
          fontSize: 13, zIndex: UI.Z_TOAST,
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
