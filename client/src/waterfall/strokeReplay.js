import { createEmptyGrid, stampCells, stampRuns } from './grid.js'
import { pointCells, strokeCells } from './brush.js'
import { floodFillRuns } from './fill.js'

/** Dựng lại lưới van từ danh sách nét. Thuần tuý — không UI, không store.
 *
 *  Undo cần cái này: lưới được cập nhật dần theo từng đoạn nét nên không thể
 *  "trừ ngược" một nét ra khỏi nó — nét sau có thể đã đè lên nét trước, và tẩy
 *  thì xoá luôn dấu vết. Cách duy nhất đúng là vẽ lại từ đầu với các nét còn
 *  lại.
 *
 *  Bán kính lưu theo Ô chứ không theo pixel màn hình (xem beginStroke), nên
 *  dựng lại cho ra đúng kết quả cũ dù cửa sổ đã đổi kích thước hay máy đã xoay
 *  ngang. Điểm cũng lưu chuẩn hoá 0..1 vì lý do đó.
 *
 *  Trả về CẢ lưới lẫn danh sách nét, vì nét tô loang không tự đứng một mình
 *  được: vùng nó phủ phụ thuộc vào những gì đã có trên lưới ngay trước nó. Bỏ
 *  một nét bút phía trước là ranh giới đổi, nên vùng tô phải tính lại cùng lúc
 *  với lưới — nếu không, thứ nhìn thấy và thứ gửi đi sẽ lệch nhau.
 *
 *  @returns {{grid: Uint8Array[], strokes: Array}}
 */
export function rebuildGrid(strokes, rowCount, cols) {
  let grid = createEmptyGrid(rowCount, cols)
  const out = []

  for (const stroke of strokes) {
    if (stroke.tool === 'fill') {
      const replayed = replayFill(grid, stroke, rowCount, cols)
      grid = replayed.grid
      out.push(replayed.stroke)
      continue
    }

    out.push(stroke)
    const value = stroke.tool === 'eraser' ? 0 : 1
    const { radRows, radCols } = stroke
    const points = stroke.points.map((p) => ({ col: p.x * cols, row: p.y * rowCount }))
    if (points.length === 0) continue

    if (points.length === 1) {
      grid = stampCells(grid, pointCells(points[0], radRows, radCols), value)
      continue
    }
    for (let i = 1; i < points.length; i++) {
      grid = stampCells(grid, strokeCells(points[i - 1], points[i], radRows, radCols), value)
    }
  }

  return { grid, strokes: out }
}

/** Tô loang lại từ đúng điểm đã chạm, trên lưới ở trạng thái hiện tại của lần
 *  dựng lại này. Trả về nét MỚI (vùng phủ đã tính lại) để phần hiển thị dùng
 *  chung một kết quả với lưới. */
function replayFill(grid, stroke, rowCount, cols) {
  const row = Math.floor(stroke.point.y * rowCount)
  const col = Math.floor(stroke.point.x * cols)
  const filled = floodFillRuns(grid, row, col)
  if (!filled) return { grid, stroke: { ...stroke, runs: [], gridRows: rowCount, gridCols: cols } }

  return {
    grid: stampRuns(grid, filled.runs, filled.value),
    stroke: { ...stroke, value: filled.value, runs: filled.runs, gridRows: rowCount, gridCols: cols },
  }
}
