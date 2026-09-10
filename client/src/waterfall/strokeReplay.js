import { createEmptyGrid, stampCells } from './grid.js'
import { pointCells, strokeCells } from './brush.js'

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
 */
export function rebuildGrid(strokes, rowCount, cols) {
  let grid = createEmptyGrid(rowCount, cols)

  for (const stroke of strokes) {
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

  return grid
}
