/** Vẽ lưới van ra canvas cho mượt mắt.
 *
 *  Ở lại thư mục component chứ không nằm trong waterfall/ vì nó phụ thuộc
 *  Canvas API — waterfall/ giữ thuần tuý (codec, grid, brush) để test được.
 *
 *  Cách làm: dựng một ảnh ĐÚNG kích thước lưới, mỗi ô một pixel, rồi phóng to
 *  bằng nội suy song tuyến của trình duyệt. Nét vì thế mềm và liền mạch thay vì
 *  bậc thang — nhưng vẫn là CHÍNH dữ liệu sẽ gửi đi, chỉ khác cách hiển thị.
 *  Không có đường vẽ riêng nào cho preview, nên preview luôn khớp thứ chạy trên
 *  màn nước.
 */

/** Dưới ngưỡng này thì đường kẻ lưới lấn hết ô, nhìn ra một mảng xám. Màn 4 m
 *  có 160 cột nên trên điện thoại luôn rơi vào trường hợp này. */
const MIN_CELL_PX_FOR_GRID_LINES = 10

function parseRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Giữ lại canvas/buffer giữa các lần vẽ — draw() chạy theo từng pointermove,
 *  cấp phát lại 160x64 mỗi lần là rác vô ích. */
export function createGridRenderer() {
  let cellCanvas = null
  let cellCtx = null
  let imageData = null

  function ensureCellCanvas(cols, rowCount) {
    if (cellCanvas && cellCanvas.width === cols && cellCanvas.height === rowCount) return
    cellCanvas = document.createElement('canvas')
    cellCanvas.width = cols
    cellCanvas.height = rowCount
    cellCtx = cellCanvas.getContext('2d')
    imageData = cellCtx.createImageData(cols, rowCount)
  }

  return function render(ctx, opts) {
    const {
      grid, cols, rowCount, width, height,
      onColor, offColor, passes, gridLineColor,
    } = opts

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = offColor
    ctx.fillRect(0, 0, width, height)

    ensureCellCanvas(cols, rowCount)

    const [r0, g0, b0] = parseRgb(onColor)
    const data = imageData.data
    data.fill(0) // ô tắt để trong suốt, nền do lớp dưới lo

    let anyOn = false
    for (let r = 0; r < rowCount; r++) {
      const row = grid[r]
      if (!row) continue
      const base = r * cols * 4
      for (let c = 0; c < cols; c++) {
        if (!row[c]) continue
        const i = base + c * 4
        data[i] = r0
        data[i + 1] = g0
        data[i + 2] = b0
        data[i + 3] = 255
        anyOn = true
      }
    }

    if (anyOn) {
      cellCtx.putImageData(imageData, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      // Vẽ chồng nhiều lượt: vùng phủ một phần đậm dần lên, mép nét sắc lại
      // mà không mất độ mịn của nội suy.
      for (let i = 0; i < passes; i++) ctx.drawImage(cellCanvas, 0, 0, width, height)
    }

    // Kẻ lưới chỉ còn ý nghĩa khi ô đủ to để nhìn ra từng ô.
    const cellW = width / cols
    const cellH = height / rowCount
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
