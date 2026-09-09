/** Vẽ lưới van thành nét liền, mượt như bút whiteboard.
 *
 *  Ở lại thư mục component chứ không nằm trong waterfall/ vì phụ thuộc Canvas
 *  API — waterfall/ giữ thuần tuý (codec, grid, brush) để test được bằng số.
 *
 *  Vì sao không vẽ đường bút riêng cho preview: như thế mắt nhìn một đằng, màn
 *  nước chạy một nẻo. Mọi hình ở đây suy hoàn toàn từ `grid`.
 *
 *  Cách làm hai bước:
 *   1. Mỗi hàng gom các ô bật liên tiếp thành một DẢI, vẽ thành thanh bo tròn.
 *   2. NỐI dải ở hàng r với dải chồng lên nó ở hàng r+1 bằng một hình thang.
 *
 *  Bước 2 mới là chỗ quan trọng. Nét xiên trên lưới 160x64 dịch ngang vài cột
 *  mỗi hàng, trong khi bản thân nét cũng chỉ rộng chừng ấy cột — hai dải liên
 *  tiếp gần như chỉ chạm góc, vẽ riêng lẻ ra sẽ thành chuỗi hạt rời. Hình thang
 *  nối tâm hàng này sang tâm hàng kia, cho ra dải liền mạch.
 *
 *  Đánh đổi có chủ ý: hình thang phủ thêm một ít diện tích ở khoảng giữa hai
 *  hàng — đó là NỘI SUY theo trục thời gian, không phải bịa thêm van. Trục cột
 *  (van, có ý nghĩa vật lý) vẫn nằm gọn giữa hai dải thật ở hai đầu.
 */

/** Ô nhỏ hơn ngưỡng này thì đường kẻ lưới lấn hết ô, nhìn ra một mảng xám. */
const MIN_CELL_PX_FOR_GRID_LINES = 14

/** roundRect chỉ có từ Safari 16 — tự vẽ để máy cũ không mất luôn hoạ tiết. */
function addRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rad)
    return
  }
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Các dải ô bật liên tiếp trong một hàng, dạng [colStart, colEndInclusive]. */
function rowRuns(row, cols) {
  const runs = []
  let start = -1
  for (let c = 0; c <= cols; c++) {
    const on = c < cols && row[c]
    if (on && start < 0) start = c
    if (on || start < 0) continue
    runs.push([start, c - 1])
    start = -1
  }
  return runs
}

export function createGridRenderer() {
  return function render(ctx, opts) {
    const {
      grid, cols, rowCount, width, height,
      onColor, offColor, gridLineColor,
      rowOverlap, cornerRound, connectGapCells,
    } = opts

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = offColor
    ctx.fillRect(0, 0, width, height)

    const cellW = width / cols
    const cellH = height / rowCount
    const barH = cellH * rowOverlap
    const halfExtra = (barH - cellH) / 2

    ctx.fillStyle = onColor
    ctx.beginPath()

    let prevRuns = null
    let prevRow = -1

    for (let r = 0; r < rowCount; r++) {
      const row = grid[r]
      const runs = row ? rowRuns(row, cols) : []

      for (const [c0, c1] of runs) {
        const x = c0 * cellW
        const w = (c1 - c0 + 1) * cellW
        addRoundedRect(ctx, x, r * cellH - halfExtra, w, barH, Math.min(w, barH) * cornerRound)
      }

      // Nối với hàng ngay trên. Bỏ qua nếu hàng trên rỗng — không bắc cầu qua
      // khoảng trống, nếu không hai nét rời nhau sẽ bị dính làm một.
      if (prevRuns && prevRow === r - 1) {
        const yTop = (prevRow + 0.5) * cellH
        const yBot = (r + 0.5) * cellH
        for (const [a0, a1] of prevRuns) {
          for (const [b0, b1] of runs) {
            // Chồng lấn hoặc cách nhau trong ngưỡng thì coi là cùng một nét.
            if (b0 - a1 > connectGapCells || a0 - b1 > connectGapCells) continue
            ctx.moveTo(a0 * cellW, yTop)
            ctx.lineTo((a1 + 1) * cellW, yTop)
            ctx.lineTo((b1 + 1) * cellW, yBot)
            ctx.lineTo(b0 * cellW, yBot)
            ctx.closePath()
          }
        }
      }

      prevRuns = runs.length ? runs : null
      prevRow = runs.length ? r : -1
    }

    // Fill một lần cho toàn bộ path: thanh và hình thang hợp thành khối liền,
    // không lộ mép do vẽ đè từng hình.
    ctx.fill()

    if (cellW < MIN_CELL_PX_FOR_GRID_LINES && cellH < MIN_CELL_PX_FOR_GRID_LINES) return

    ctx.strokeStyle = gridLineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    if (cellW >= MIN_CELL_PX_FOR_GRID_LINES) {
      for (let c = 0; c <= cols; c++) {
        const x = Math.round(c * cellW) + 0.5
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
    }
    if (cellH >= MIN_CELL_PX_FOR_GRID_LINES) {
      for (let r = 0; r <= rowCount; r++) {
        const y = Math.round(r * cellH) + 0.5
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
    }
    ctx.stroke()
  }
}
