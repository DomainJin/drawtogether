/** Biến DẢI ô trên lưới van thành hình vẽ mượt. Thuần tuý — không Canvas, không
 *  UI, nên kiểm được bằng số.
 *
 *  Lưới van rất hẹp và cao (160 cột × vài trăm hàng), nên ô trên màn hình cao
 *  gấp nhiều lần bề rộng. Vẽ thẳng mỗi ô thành một hình chữ nhật thì biên xiên
 *  hiện thành bậc thang to đúng bằng chiều cao một hàng — đó chính là răng cưa
 *  nhìn thấy ở vùng tô loang.
 *
 *  Cách chữa gồm hai phần, và phần thứ hai mới là phần quan trọng:
 *   1. Mỗi dải ô bật liên tiếp trong một hàng thành một THANH bo góc.
 *   2. NỐI thanh ở hàng r với thanh chồng lên nó ở hàng r+1 bằng một HÌNH
 *      THANG, chạy từ tâm hàng này sang tâm hàng kia.
 *
 *  Hình thang nội suy bề rộng giữa hai hàng, nên góc vuông của bậc thang bị vạt
 *  thành cạnh xiên dài đúng một hàng. Biên đang gãy khúc 90° trở thành đường
 *  dốc liên tục.
 *
 *  Đánh đổi có chủ ý: hình thang phủ thêm một ít diện tích ở khoảng giữa hai
 *  hàng — đó là NỘI SUY theo trục thời gian, không phải bịa thêm van. Trục cột
 *  (van, có ý nghĩa vật lý) vẫn nằm gọn giữa hai dải thật ở hai đầu.
 *
 *  Dùng chung cho cả hai chỗ cần vẽ từ lưới: chế độ xem "Lưới" và vùng tô
 *  loang. Trước đây tô loang tự vẽ hình chữ nhật thô nên mượt một đằng, răng
 *  cưa một nẻo dù cùng nguồn dữ liệu.
 */

/** Các dải ô bật liên tiếp trong một hàng, dạng [colStart, colEndInclusive]. */
export function rowRuns(row, cols) {
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

/** Toàn bộ dải ô bật của một lưới, phẳng và đã sắp theo hàng. */
export function gridRuns(grid, rowCount, cols) {
  const out = []
  for (let r = 0; r < rowCount; r++) {
    const row = grid[r]
    if (!row) continue
    for (const [c0, c1] of rowRuns(row, cols)) out.push({ row: r, c0, c1 })
  }
  return out
}

/** Gom dải theo hàng. Nhận danh sách phẳng đã sắp theo hàng; nếu chưa sắp thì
 *  tự sắp, vì gom nhầm hàng là mất hình chứ không phải xấu hình. */
function groupByRow(runs) {
  let sorted = runs
  for (let i = 1; i < runs.length; i++) {
    if (runs[i].row < runs[i - 1].row) {
      sorted = [...runs].sort((a, b) => (a.row - b.row) || (a.c0 - b.c0))
      break
    }
  }

  const byRow = []
  for (const run of sorted) {
    const last = byRow[byRow.length - 1]
    if (last && last.row === run.row) last.list.push(run)
    else byRow.push({ row: run.row, list: [run] })
  }
  return byRow
}

/**
 * Dải ô → hình để vẽ, tính bằng pixel trên màn.
 *
 * @param {Array<{row:number,c0:number,c1:number}>} runs
 * @param {object} opts
 * @param {number} opts.cellW  bề rộng một ô (px)
 * @param {number} opts.cellH  chiều cao một hàng (px)
 * @param {number} opts.rowOverlap      thanh cao gấp bấy nhiêu lần một hàng
 * @param {number} opts.cornerRound     độ bo góc theo cạnh ngắn (0..0.5)
 * @param {number} opts.connectGapCells hai dải cách nhau tối đa bấy nhiêu cột
 *                                      thì vẫn coi là cùng một nét và được nối
 * @returns {{bars: Array<{x,y,w,h,r}>, links: Array<Array<{x,y}>>}}
 */
export function runsToShapes(runs, opts) {
  const { cellW, cellH, rowOverlap, cornerRound, connectGapCells } = opts
  const barH = cellH * rowOverlap
  const halfExtra = (barH - cellH) / 2

  const bars = []
  const links = []
  const byRow = groupByRow(runs)

  for (let i = 0; i < byRow.length; i++) {
    const { row, list } = byRow[i]

    for (const { c0, c1 } of list) {
      const x = c0 * cellW
      const w = (c1 - c0 + 1) * cellW
      bars.push({
        x, y: row * cellH - halfExtra, w, h: barH,
        r: Math.min(w, barH) * cornerRound,
      })
    }

    // Chỉ nối với hàng NGAY TRÊN. Bỏ qua khi hàng trên rỗng — không bắc cầu
    // qua khoảng trống, nếu không hai nét rời nhau sẽ bị dính làm một.
    const prev = byRow[i - 1]
    if (!prev || prev.row !== row - 1) continue

    const yTop = (prev.row + 0.5) * cellH
    const yBot = (row + 0.5) * cellH
    for (const a of prev.list) {
      for (const b of list) {
        // Chồng lấn hoặc cách nhau trong ngưỡng thì coi là cùng một nét.
        if (b.c0 - a.c1 > connectGapCells || a.c0 - b.c1 > connectGapCells) continue
        links.push([
          { x: a.c0 * cellW, y: yTop },
          { x: (a.c1 + 1) * cellW, y: yTop },
          { x: (b.c1 + 1) * cellW, y: yBot },
          { x: b.c0 * cellW, y: yBot },
        ])
      }
    }
  }

  return { bars, links }
}
