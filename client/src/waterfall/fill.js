/** Tô loang (paint bucket) trên lưới van. Thuần tuý — không UI, không store,
 *  không Canvas API, nên test được bằng số.
 *
 *  Lưới van là NHỊ PHÂN: một ô chỉ có mở (1) hoặc đóng (0). Vì thế tô loang ở
 *  đây có đúng một nghĩa tự nhiên: lấy vùng liền nhau cùng giá trị với ô được
 *  chạm rồi lật nó sang giá trị kia. Chạm vào khoảng trắng thì đổ đầy khoảng
 *  trắng đó; chạm vào một mảng đã vẽ thì xoá sạch cả mảng — khỏi phải gôm từng
 *  chỗ bằng tẩy.
 *
 *  Liền nhau tính theo 4 hướng (trên/dưới/trái/phải), KHÔNG tính chéo. Vì nét
 *  bút chỉ chạm góc ở chỗ xiên là chuyện thường trên lưới 160 cột × vài trăm
 *  hàng, nếu cho loang chéo thì mực sẽ chui qua khe góc và tràn ra ngoài nét
 *  bao — đúng cái lỗi "tô một vùng kín mà cả canvas đen sì".
 *
 *  Trả về DẢI (run) theo từng hàng chứ không phải từng ô: một lần tô có thể
 *  chạm tới hàng chục nghìn ô, giữ dạng dải thì cả việc đóng dấu lên lưới lẫn
 *  việc vẽ lại khi hiển thị đều rẻ hơn hẳn, mà vẫn không mất mát thông tin.
 */

/**
 * @param {Uint8Array[]} grid
 * @param {number} row  hàng được chạm (số nguyên)
 * @param {number} col  cột được chạm (số nguyên)
 * @returns {{value: number, runs: Array<{row:number,c0:number,c1:number}>} | null}
 *          null khi chạm ra ngoài lưới.
 */
export function floodFillRuns(grid, row, col) {
  const rows = grid.length
  if (rows === 0) return null
  if (row < 0 || row >= rows) return null
  const cols = grid[row].length
  if (col < 0 || col >= cols) return null

  const target = grid[row][col]
  const value = target ? 0 : 1

  const visited = Array.from({ length: rows }, () => new Uint8Array(cols))
  const runs = []

  // Stack phẳng (row, col xen kẽ) thay vì mảng cặp: vùng tô có thể rất lớn,
  // tạo hàng chục nghìn object nhỏ chỉ để rồi vứt đi là phí.
  const stack = [row, col]

  while (stack.length) {
    const c = stack.pop()
    const r = stack.pop()
    if (visited[r][c] || grid[r][c] !== target) continue

    // Nới sang hai bên hết cỡ trong cùng một hàng, rồi mới xét hai hàng kề —
    // thuật toán scanline, ít lần vào stack hơn tô từng ô rất nhiều.
    let c0 = c
    while (c0 > 0 && grid[r][c0 - 1] === target && !visited[r][c0 - 1]) c0--
    let c1 = c
    while (c1 + 1 < cols && grid[r][c1 + 1] === target && !visited[r][c1 + 1]) c1++

    for (let x = c0; x <= c1; x++) visited[r][x] = 1
    runs.push({ row: r, c0, c1 })

    for (const nr of [r - 1, r + 1]) {
      if (nr < 0 || nr >= rows) continue
      // Chỉ đẩy ô ĐẦU mỗi đoạn liền nhau ở hàng kề: các ô còn lại của đoạn sẽ
      // được scanline phía trên gom nốt.
      let inRun = false
      for (let x = c0; x <= c1; x++) {
        const ok = grid[nr][x] === target && !visited[nr][x]
        if (ok && !inRun) { stack.push(nr, x); inRun = true }
        else if (!ok) inRun = false
      }
    }
  }

  runs.sort((a, b) => (a.row - b.row) || (a.c0 - b.c0))
  return { value, runs }
}

/** Số ô mà một danh sách dải phủ tới. Dùng cho test và cho hiển thị. */
export function runsCellCount(runs) {
  let n = 0
  for (const { c0, c1 } of runs) n += c1 - c0 + 1
  return n
}
