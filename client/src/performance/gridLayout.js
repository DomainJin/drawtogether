/** Xếp N chữ ký thành lưới trong vùng W×H (px vùng LED). Pure.
 *
 *  Thử mọi số cột, chọn số cột cho chữ ký cao nhất với tỉ lệ trung bình
 *  `aspect` (rộng/cao). Ô được thu gọn theo tỉ lệ đó rồi cả khối căn giữa —
 *  không để lưới giãn hết vùng khi chỉ có 2-3 chữ ký. Hàng cuối thiếu ô cũng
 *  căn giữa. Thứ tự: trái→phải, trên→dưới. */
export function gridLayout(n, W, H, aspect, gap = 0, padding = 0) {
  if (n <= 0 || W <= 0 || H <= 0) return { cols: 0, rows: 0, slots: [] }
  const a = Math.max(0.1, aspect || 1)
  const innerW = Math.max(1, W - 2 * padding)
  const innerH = Math.max(1, H - 2 * padding)

  let best = null
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    const cw = (innerW - (cols - 1) * gap) / cols
    const ch = (innerH - (rows - 1) * gap) / rows
    if (cw <= 0 || ch <= 0) continue
    const itemH = Math.min(ch, cw / a)
    if (!best || itemH > best.itemH + 1e-9) best = { cols, rows, itemH }
  }
  if (!best) return { cols: 0, rows: 0, slots: [] }

  const { cols, rows, itemH } = best
  const cellH = itemH
  const cellW = Math.min((innerW - (cols - 1) * gap) / cols, itemH * a)
  const blockH = rows * cellH + (rows - 1) * gap
  const top = padding + (innerH - blockH) / 2

  const slots = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const c = i % cols
    const inRow = r === rows - 1 ? n - r * cols : cols
    const rowW = inRow * cellW + (inRow - 1) * gap
    const left = padding + (innerW - rowW) / 2
    slots.push({ x: left + c * (cellW + gap), y: top + r * (cellH + gap), w: cellW, h: cellH })
  }
  return { cols, rows, slots }
}
