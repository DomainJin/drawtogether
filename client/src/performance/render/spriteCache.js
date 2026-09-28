/** Sprite chữ ký đã vẽ sẵn — frame chỉ drawImage, không vẽ lại nét + quầng
 *  sáng (shadowBlur rất đắt) của hàng trăm chữ ký mỗi frame.
 *
 *  Mỗi chữ ký giữ MỘT sprite. Vẽ lại khi style đổi, khi cần to hơn đáng kể
 *  (phóng to sẽ mờ), hoặc nhỏ hơn nhiều (giữ bản to phí RAM). Số sprite vẽ mỗi
 *  frame bị giới hạn bởi `budget` — caller cấp mỗi frame. */
import { PERF_CONFIG as P } from '../config.js'
import { layoutFor, renderSignatureCanvas } from './drawSignature.js'

export function createSpriteCache() {
  const sprites = new Map() // id → { canvas, px, styleKey }
  const layouts = new Map() // id → { layout, styleKey }
  let styleKey = ''
  let style = null

  return {
    /** Gọi mỗi frame với style hiện tại; đổi style → mọi sprite hết hạn (vẽ
     *  lại dần theo budget, bản cũ vẫn dùng tạm để màn hình không trống). */
    setStyle(nextStyle, key) {
      if (key === styleKey) return
      styleKey = key
      style = nextStyle
      layouts.clear()
    },

    layout(sig) {
      let e = layouts.get(sig.id)
      if (!e) {
        e = { layout: layoutFor(sig, style) }
        layouts.set(sig.id, e)
      }
      return e.layout
    },

    aspect(sig) {
      const l = this.layout(sig)
      return l.h > 0 ? l.w / l.h : 1
    },

    /** Sprite dùng được để vẽ hộp cao `neededPx`, hoặc null (chưa có và hết
     *  budget frame này). `budget` = { left: number } — bị trừ khi vẽ sprite. */
    get(sig, neededPx, budget) {
      const want = Math.min(P.SPRITE_MAX_PX, Math.max(P.SPRITE_MIN_PX, Math.ceil(neededPx)))
      const cur = sprites.get(sig.id)
      const stale = !cur
        || cur.styleKey !== styleKey
        || cur.px < want / P.SPRITE_UPSCALE_TOLERANCE
        || cur.px > want * P.SPRITE_DOWNSCALE_TOLERANCE
      if (stale && budget.left > 0) {
        budget.left--
        const canvas = renderSignatureCanvas(sig, style, want, this.layout(sig))
        const next = { canvas, px: want, styleKey }
        sprites.set(sig.id, next)
        return next.canvas
      }
      return cur ? cur.canvas : null
    },

    /** Bỏ sprite của chữ ký không còn trên màn hình. */
    prune(liveIds) {
      for (const id of sprites.keys()) if (!liveIds.has(id)) sprites.delete(id)
      for (const id of layouts.keys()) if (!liveIds.has(id)) layouts.delete(id)
    },

    clear() {
      sprites.clear()
      layouts.clear()
      styleKey = ''
    },
  }
}
