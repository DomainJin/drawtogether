/** Hiệu ứng xuất hiện của chữ ký mới. Pure: tiến độ p ∈ [0,1] → trạng thái vẽ.
 *  dy tính theo cao hộp chữ ký; drawProgress < 1 = đang "viết" (vẽ trực tiếp,
 *  không dùng sprite). */

const clamp01 = (v) => Math.min(1, Math.max(0, v))
export const easeOutCubic = (p) => 1 - (1 - p) ** 3
export const easeOutBack = (p) => {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * (p - 1) ** 3 + c1 * (p - 1) ** 2
}

export const SETTLED = Object.freeze({ alpha: 1, scale: 1, dy: 0, drawProgress: 1 })

export function entranceState(effect, progress) {
  const p = clamp01(progress)
  if (p >= 1) return SETTLED
  const e = easeOutCubic(p)
  switch (effect) {
    case 'fade':
      return { alpha: e, scale: 1, dy: 0, drawProgress: 1 }
    case 'zoom':
      return { alpha: clamp01(p * 3), scale: 0.3 + 0.7 * easeOutBack(p), dy: 0, drawProgress: 1 }
    case 'fly':
      return { alpha: clamp01(p * 2), scale: 1, dy: (1 - e) * 1.5, drawProgress: 1 }
    case 'draw':
      return { alpha: 1, scale: 1, dy: 0, drawProgress: p }
    default:
      return SETTLED
  }
}
