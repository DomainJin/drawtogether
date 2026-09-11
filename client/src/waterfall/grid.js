export function createEmptyGrid(rows, cols) {
  return Array.from({ length: rows }, () => new Uint8Array(cols))
}

export function resizeGrid(grid, rows, cols) {
  const out = createEmptyGrid(rows, cols)
  const copyRows = Math.min(rows, grid.length)
  for (let r = 0; r < copyRows; r++) {
    const src = grid[r]
    const copyCols = Math.min(cols, src.length)
    out[r].set(src.subarray(0, copyCols))
  }
  return out
}

export function setCell(grid, row, col, value) {
  if (row < 0 || row >= grid.length) return grid
  if (col < 0 || col >= grid[row].length) return grid
  if (grid[row][col] === value) return grid
  const nextRow = grid[row].slice()
  nextRow[col] = value
  const next = grid.slice()
  next[row] = nextRow
  return next
}

/** Đặt một loạt ô về cùng giá trị trong MỘT lần cập nhật bất biến.
 *
 *  Một nét bút cỡ lớn chạm tới hàng trăm ô mỗi lần pointermove; gọi setCell()
 *  cho từng ô sẽ copy lại mảng hàng chừng ấy lần. Ở đây mỗi hàng bị chạm chỉ
 *  copy đúng một lần. Trả về chính `grid` cũ nếu không có gì đổi, để React
 *  không phải render lại.
 *
 *  @param {Array<{row:number,col:number}>} cells
 */
export function stampCells(grid, cells, value) {
  const touched = new Map()

  for (const { row, col } of cells) {
    if (row < 0 || row >= grid.length) continue
    if (col < 0 || col >= grid[row].length) continue

    let next = touched.get(row)
    if (!next) {
      if (grid[row][col] === value) continue // chưa cần copy hàng này
      next = grid[row].slice()
      touched.set(row, next)
    }
    next[col] = value
  }

  if (touched.size === 0) return grid

  const out = grid.slice()
  for (const [row, next] of touched) out[row] = next
  return out
}

export function isGridEmpty(grid) {
  return grid.every((row) => row.every((v) => v === 0))
}

/** Như stampCells() nhưng nhận DẢI [c0..c1] theo hàng — dạng mà tô loang trả
 *  về. Một lần tô có thể phủ hàng chục nghìn ô; đi theo dải thì mỗi hàng bị
 *  chạm chỉ copy đúng một lần và phần ghi là một vòng for liền mạch.
 *
 *  @param {Array<{row:number,c0:number,c1:number}>} runs
 */
export function stampRuns(grid, runs, value) {
  const touched = new Map()

  for (const { row, c0, c1 } of runs) {
    if (row < 0 || row >= grid.length) continue
    const width = grid[row].length
    const from = Math.max(0, c0)
    const to = Math.min(width - 1, c1)
    if (to < from) continue

    let next = touched.get(row)
    if (!next) {
      next = grid[row].slice()
      touched.set(row, next)
    }
    next.fill(value, from, to + 1)
  }

  if (touched.size === 0) return grid

  const out = grid.slice()
  for (const [row, next] of touched) out[row] = next
  return out
}
