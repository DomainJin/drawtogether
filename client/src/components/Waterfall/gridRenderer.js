import { gridRuns, runsToShapes } from '../../waterfall/runGeometry.js'
import { addShapesToPath } from './runsPath.js'

/** Vẽ lưới van thành nét liền, mượt như bút whiteboard.
 *
 *  Vì sao không vẽ đường bút riêng cho preview: như thế mắt nhìn một đằng, màn
 *  nước chạy một nẻo. Mọi hình ở đây suy hoàn toàn từ `grid`.
 *
 *  Phần hình học (dải → thanh bo góc + hình thang nối hai hàng) nằm ở
 *  runGeometry.js và dùng chung với vùng tô loang, nên hai chỗ vẽ từ lưới
 *  không thể mượt khác nhau được nữa.
 */

/** Ô nhỏ hơn ngưỡng này thì đường kẻ lưới lấn hết ô, nhìn ra một mảng xám. */
const MIN_CELL_PX_FOR_GRID_LINES = 14

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

    const shapes = runsToShapes(gridRuns(grid, rowCount, cols), {
      cellW, cellH, rowOverlap, cornerRound, connectGapCells,
    })

    ctx.fillStyle = onColor
    ctx.beginPath()
    addShapesToPath(ctx, shapes)
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
