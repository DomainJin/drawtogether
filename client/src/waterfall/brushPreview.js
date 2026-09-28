import { WATERFALL_CONFIG as CFG } from './config.js'

/** Đường kính chấm xem trước cỡ nét trên nút.
 *
 *  Vẽ đúng pixel thì mọi cỡ lớn hơn ô nút đều bị cắt về cùng một chấm —
 *  34/50/70 trông y hệt nhau. Theo căn bậc hai (tỉ lệ diện tích) thì cỡ nào
 *  cũng phân biệt được mà nét lớn nhất vẫn vừa trong nút.
 *
 *  @param {number} px cỡ nét
 *  @param {number} btn cạnh nút (px) — chấm lớn nhất chừa 6px mỗi bên */
export function brushDotPx(px, btn, sizes = CFG.BRUSH_SIZES_PX) {
  const maxDot = btn - 12
  const maxPx = Math.max(...sizes)
  return Math.max(4, Math.round(maxDot * Math.sqrt(px / maxPx)))
}
