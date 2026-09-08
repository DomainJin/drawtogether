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

export function isGridEmpty(grid) {
  return grid.every((row) => row.every((v) => v === 0))
}
