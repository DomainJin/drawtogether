import { memo, useEffect, useRef } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { drawSignature } from '../../../performance/render/drawSignature.js'

/** Ảnh nhỏ của chữ ký với style hiện tại — vẽ một lần, vẽ lại khi style đổi. */
function SignatureThumb({ sig, style, fontVersion }) {
  const ref = useRef(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const h = P.THUMB_HEIGHT_PX
    const w = h * 2
    c.width = w * dpr
    c.height = h * dpr
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawSignature(ctx, sig, style, { x: 4, y: 4, w: w - 8, h: h - 8 })
  }, [sig, style, fontVersion])
  return <canvas ref={ref} style={{ width: P.THUMB_HEIGHT_PX * 2, height: P.THUMB_HEIGHT_PX, display: 'block' }} />
}

export default memo(SignatureThumb)
