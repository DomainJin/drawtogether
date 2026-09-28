/** Bố cục MỘT chữ ký (nét + tên bên dưới) trong pad units — cao bảng ký = 1.
 *
 *  Pure: đo chữ đi qua `measureName(text, sizePadUnits) → width` do caller cấp
 *  (canvas thật ở trình duyệt, hàm giả trong test). Mọi nơi vẽ chữ ký — bảng ký,
 *  màn show, preview, PNG xuất — đều dùng bố cục này (WYSIWYG). */
import { PERF_CONFIG as P } from './config.js'
import { strokesBounds } from './strokeCodec.js'

/** Lề quanh nét: nửa độ dày nét + chỗ cho quầng sáng. */
export function inkMargin(style) {
  return style.ink.width / 2 + style.ink.glow * P.GLOW_MAX * 1.2
}

/**
 * @returns {{w, h, ink: {x, y, minX, minY}, name: {x, y, size, text} | null}}
 *   ink.x/y: chỗ đặt gốc (minX,minY) của nét trong hộp; name.x = tâm ngang,
 *   name.y = đường baseline giữa (textBaseline 'middle').
 */
export function signatureLayout(sig, style, measureName) {
  const m = inkMargin(style)
  const b = strokesBounds(sig.strokes, sig.aspect) ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  const inkW = b.maxX - b.minX + 2 * m
  const inkH = b.maxY - b.minY + 2 * m

  const text = style.name.show ? (sig.name || '').trim() : ''
  if (!text) {
    return { w: inkW, h: inkH, ink: { x: m, y: m, minX: b.minX, minY: b.minY }, name: null }
  }

  const size = style.name.size
  // Chừa chỗ cho viền/bóng/quầng của chữ (xem drawName).
  const namePad = size * 0.35
  const nameW = measureName(text, size) + 2 * namePad
  const nameH = size + 2 * namePad
  const gap = size * P.NAME_GAP
  const w = Math.max(inkW, nameW)
  return {
    w,
    h: inkH + gap + nameH,
    ink: { x: (w - inkW) / 2 + m, y: m, minX: b.minX, minY: b.minY },
    name: { x: w / 2, y: inkH + gap + nameH / 2, size, text },
  }
}

/** Thu phóng hộp bố cục vào khung (giữ tỉ lệ, căn giữa).
 *  @returns {{scale, x, y}} x,y = góc trên-trái của bố cục trong khung */
export function fitLayout(layout, box) {
  if (layout.w <= 0 || layout.h <= 0) return { scale: 0, x: box.x, y: box.y }
  const scale = Math.min(box.w / layout.w, box.h / layout.h)
  return {
    scale,
    x: box.x + (box.w - layout.w * scale) / 2,
    y: box.y + (box.h - layout.h * scale) / 2,
  }
}
