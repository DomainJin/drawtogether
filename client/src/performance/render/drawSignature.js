/** Vẽ chữ ký lên canvas — MỘT đường vẽ cho bảng ký, màn show, preview setup và
 *  PNG xuất ra (WYSIWYG). Style = { ink, name } lấy thẳng từ config sự kiện.
 *
 *  Lưu ý canvas: shadowBlur và cỡ font nhỏ KHÔNG đi theo transform như toạ độ.
 *  shadowBlur tính bằng px thiết bị → nhân với hệ số transform hiện tại. Font
 *  cỡ 0.2px rồi scale ×500 hiển thị sai trên Chrome → vẽ tên ở hệ px thật. */
import { PERF_CONFIG as P } from '../config.js'
import { signatureLayout, fitLayout } from '../signatureLayout.js'
import { signatureDuration, strokesBounds } from '../strokeCodec.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))
const MEASURE_PX = 100

let measureCtx = null
const measureCache = new Map()

function fontSpec(font, px) {
  return `${px}px "${font}", "Segoe Script", cursive`
}

/** Đo tên (pad units) bằng canvas phụ; cache theo font+text. */
export function nameMeasurer(font) {
  return (text, size) => {
    const key = font + '\u0000' + text
    let w = measureCache.get(key)
    if (w === undefined) {
      measureCtx ??= document.createElement('canvas').getContext('2d')
      measureCtx.font = fontSpec(font, MEASURE_PX)
      w = measureCtx.measureText(text).width / MEASURE_PX
      if (measureCache.size > 2000) measureCache.clear()
      measureCache.set(key, w)
    }
    return w * size
  }
}

/** Font web vừa tải xong → số đo cũ (đo bằng font dự phòng) sai. */
export function clearMeasureCache() {
  measureCache.clear()
}

export function layoutFor(sig, style) {
  return signatureLayout(sig, style, nameMeasurer(style.name.font))
}

const currentScale = (ctx) => {
  const m = ctx.getTransform()
  return Math.hypot(m.a, m.b) || 1
}

function inkPaint(ctx, sig, ink) {
  if (ink.mode === 'signer') return sig.color || ink.color
  if (ink.mode === 'solid') return ink.color
  const b = strokesBounds(sig.strokes, sig.aspect) ?? { minX: 0, maxX: 1 }
  const g = ctx.createLinearGradient(b.minX, 0, Math.max(b.maxX, b.minX + 0.01), 0)
  if (ink.mode === 'gradient') {
    g.addColorStop(0, ink.color)
    g.addColorStop(1, ink.color2)
  } else {
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${i * 50}, 95%, 62%)`)
  }
  return g
}

/** Đường cong qua các điểm [from, to) của nét (mảng phẳng), điểm cuối có thể
 *  là điểm nội suy (đang viết dở). */
function tracePath(ctx, pts, aspect) {
  const n = pts.length / 3
  ctx.beginPath()
  ctx.moveTo(pts[0] * aspect, pts[1])
  if (n === 2) {
    ctx.lineTo(pts[3] * aspect, pts[4])
    return
  }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 3] * aspect, y = pts[i * 3 + 1]
    const nx = pts[(i + 1) * 3] * aspect, ny = pts[(i + 1) * 3 + 1]
    ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2)
  }
  ctx.lineTo(pts[(n - 1) * 3] * aspect, pts[(n - 1) * 3 + 1])
}

/** Phần nét đã "viết" tới thời điểm `cutoff` (ms). */
function partialStroke(s, cutoff) {
  if (s[2] > cutoff) return null
  const n = s.length / 3
  if (s[(n - 1) * 3 + 2] <= cutoff) return s
  let i = 1
  while (i < n && s[i * 3 + 2] <= cutoff) i++
  const out = s.slice(0, i * 3)
  const t0 = s[(i - 1) * 3 + 2], t1 = s[i * 3 + 2]
  const f = t1 > t0 ? (cutoff - t0) / (t1 - t0) : 1
  out.push(
    s[(i - 1) * 3] + (s[i * 3] - s[(i - 1) * 3]) * f,
    s[(i - 1) * 3 + 1] + (s[i * 3 + 1] - s[(i - 1) * 3 + 1]) * f,
    cutoff,
  )
  return out
}

/** Nét chữ ký trong pad units ở transform hiện tại (cao bảng ký = 1 đơn vị). */
export function drawInk(ctx, sig, ink, progress = 1) {
  const duration = signatureDuration(sig.strokes)
  const cutoff = progress >= 1 ? Infinity : duration * clamp01(progress)
  const aspect = sig.aspect
  ctx.save()
  const paint = inkPaint(ctx, sig, ink)
  ctx.strokeStyle = paint
  ctx.fillStyle = paint
  ctx.lineWidth = ink.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (ink.glow > 0) {
    ctx.shadowColor = ink.glowColor
    ctx.shadowBlur = ink.glow * P.GLOW_MAX * currentScale(ctx)
  }
  for (const s of sig.strokes) {
    const pts = cutoff === Infinity ? s : partialStroke(s, cutoff)
    if (!pts || pts.length < 3) continue
    if (pts.length === 3) {
      ctx.beginPath()
      ctx.arc(pts[0] * aspect, pts[1], ink.width / 2, 0, Math.PI * 2)
      ctx.fill()
      continue
    }
    tracePath(ctx, pts, aspect)
    ctx.stroke()
  }
  ctx.restore()
}

/** Tên theo kiểu wordart. (x, y) = tâm dòng, px = cỡ chữ — đều ở hệ px hiện tại. */
function drawName(ctx, text, x, y, px, name, deviceScale) {
  ctx.save()
  ctx.font = fontSpec(name.font, px)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  switch (name.style) {
    case 'gradient': {
      const g = ctx.createLinearGradient(0, y - px / 2, 0, y + px / 2)
      g.addColorStop(0, name.color)
      g.addColorStop(1, name.color2)
      ctx.fillStyle = g
      ctx.fillText(text, x, y)
      break
    }
    case 'outline':
      ctx.strokeStyle = name.color2
      ctx.lineWidth = px * 0.1
      ctx.strokeText(text, x, y)
      ctx.fillStyle = name.color
      ctx.fillText(text, x, y)
      break
    case 'shadow': {
      const depth = px * 0.07
      ctx.fillStyle = name.color2
      for (let i = 6; i >= 1; i--) ctx.fillText(text, x + (depth * i) / 6, y + (depth * i) / 6)
      ctx.fillStyle = name.color
      ctx.fillText(text, x, y)
      break
    }
    case 'neon':
      ctx.shadowColor = name.color2
      ctx.shadowBlur = px * 0.35 * deviceScale
      ctx.fillStyle = name.color
      ctx.fillText(text, x, y)
      ctx.fillText(text, x, y)
      break
    default:
      ctx.fillStyle = name.color
      ctx.fillText(text, x, y)
  }
  ctx.restore()
}

/**
 * Vẽ cả chữ ký (nét + tên) vừa vào `box` (hệ toạ độ hiện tại của ctx).
 * @param {number} progress 0..1 — tiến độ hiệu ứng "viết"; tên hiện ở 25% cuối.
 * @param {object} [layout] truyền vào nếu đã tính sẵn (tránh đo lại mỗi frame).
 */
export function drawSignature(ctx, sig, style, box, progress = 1, layout = layoutFor(sig, style)) {
  const fit = fitLayout(layout, box)
  if (fit.scale <= 0) return
  ctx.save()
  ctx.translate(fit.x, fit.y)
  ctx.save()
  ctx.scale(fit.scale, fit.scale)
  ctx.translate(layout.ink.x - layout.ink.minX, layout.ink.y - layout.ink.minY)
  drawInk(ctx, sig, style.ink, progress)
  ctx.restore()

  const nameAlpha = progress >= 1 ? 1 : clamp01((progress - 0.75) / 0.25)
  if (layout.name && nameAlpha > 0) {
    ctx.globalAlpha *= nameAlpha
    const n = layout.name
    drawName(ctx, n.text, n.x * fit.scale, n.y * fit.scale, n.size * fit.scale, style.name, currentScale(ctx))
  }
  ctx.restore()
}

/** Chữ ký thành canvas riêng cao `heightPx`, nền trong suốt — sprite cho màn
 *  show, và cũng là PNG xuất ra. */
export function renderSignatureCanvas(sig, style, heightPx, layout = layoutFor(sig, style)) {
  const h = Math.max(1, Math.round(heightPx))
  const w = Math.max(1, Math.round((layout.w / layout.h) * h))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  drawSignature(canvas.getContext('2d'), sig, style, { x: 0, y: 0, w, h }, 1, layout)
  return canvas
}
