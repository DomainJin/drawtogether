/** Vẽ lưới van thành nét liền, mượt như bút whiteboard.
 *
 *  Ở lại thư mục component chứ không nằm trong waterfall/ vì phụ thuộc Canvas
 *  API — waterfall/ giữ thuần tuý (codec, grid, brush) để test được bằng số.
 *
 *  Cách làm: mỗi hàng gom các ô bật liên tiếp thành một DẢI, vẽ dải đó thành
 *  một thanh bo tròn, tất cả gộp vào MỘT path rồi fill một lần. Các thanh chồng
 *  lên nhau nên hợp lại thành khối liền, không có đường nối hay răng cưa.
 *
 *  Vì sao không vẽ đường bút riêng cho preview: như thế mắt nhìn một đằng, màn
 *  nước chạy một nẻo. Ở đây hình vẽ ra suy hoàn toàn từ `grid` — đúng dữ liệu
 *  sẽ được gửi đi.
 *
 *  Đánh đổi có chủ ý giữa hai trục:
 *   - Trục CỘT (van, có ý nghĩa vật lý): giữ chính xác. Bo góc chỉ ăn bớt vào
 *     trong, không bao giờ lấn ra cột chưa bật.
 *   - Trục HÀNG (thời gian): cho phép nở ra để các hàng chồng nhau, nhờ vậy nét
 *     xiên thành dải liền thay vì bậc thang.
 */

/** Ô nhỏ hơn ngưỡng này thì đường kẻ lưới lấn hết ô, nhìn ra một mảng xám.
 *  Màn 4 m có 160 cột nên trên điện thoại luôn rơi vào trường hợp này. */
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

export function createGridRenderer() {
  return function render(ctx, opts) {
    const {
      grid, cols, rowCount, width, height,
      onColor, offColor, gridLineColor,
      rowOverlap, cornerRound,
    } = opts

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = offColor
    ctx.fillRect(0, 0, width, height)

    const cellW = width / cols
    const cellH = height / rowCount

    // Chiều cao thanh lớn hơn một hàng để hàng kề nhau chồng lên, xoá chỗ khuyết
    // ở mối nối. Vẽ quanh tâm hàng nên phần nở chia đều lên và xuống.
    const barH = cellH * rowOverlap
    const halfExtra = (barH - cellH) / 2

    ctx.fillStyle = onColor
    ctx.beginPath()

    for (let r = 0; r < rowCount; r++) {
      const row = grid[r]
      if (!row) continue

      let runStart = -1
      for (let c = 0; c <= cols; c++) {
        const on = c < cols && row[c]
        if (on && runStart < 0) runStart = c
        if (on || runStart < 0) continue

        // Kết thúc một dải: [runStart, c-1]
        const x = runStart * cellW
        const w = (c - runStart) * cellW
        const y = r * cellH - halfExtra
        addRoundedRect(ctx, x, y, w, barH, Math.min(w, barH) * cornerRound)
        runStart = -1
      }
    }

    // Fill một lần cho toàn bộ path: các thanh chồng nhau hợp thành khối liền,
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
