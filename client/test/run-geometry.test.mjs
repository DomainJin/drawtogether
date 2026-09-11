/** Dải ô → hình vẽ: kiểm độ mượt bằng SỐ.
 *
 *  Răng cưa là thứ mắt thấy mà test khó thấy, nên phải quy nó về một con số.
 *  Đo thế này: với một biên xiên, hình chữ nhật trần cho bước nhảy ngang xảy ra
 *  tại ĐÚNG MỘT giá trị y (góc vuông 90°), còn hình thang nối trải bước nhảy đó
 *  ra suốt một hàng theo chiều dọc (cạnh dốc). Kiểm chiều cao của đoạn chuyển
 *  tiếp đó là kiểm được răng cưa đã bị vạt hay chưa.
 */
import { rowRuns, gridRuns, runsToShapes } from '../src/waterfall/runGeometry.js'
import { floodFillRuns } from '../src/waterfall/fill.js'
import { createEmptyGrid, stampRuns } from '../src/waterfall/grid.js'
import { WATERFALL_CONFIG as CFG } from '../src/waterfall/config.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

const CELL_W = 4
const CELL_H = 14          // ô cao gấp 3,5 lần bề rộng, như lưới van thật
const OPTS = {
  cellW: CELL_W, cellH: CELL_H,
  rowOverlap: CFG.PREVIEW_ROW_OVERLAP,
  cornerRound: CFG.PREVIEW_CORNER_ROUND,
  connectGapCells: CFG.PREVIEW_CONNECT_GAP_CELLS,
}

const row = (cells) => Uint8Array.from(cells)

// ── rowRuns / gridRuns ─────────────────────────────────────────────────────
t('rowRuns gom ô bật liên tiếp',
  JSON.stringify(rowRuns(row([0, 1, 1, 0, 1]), 5)) === JSON.stringify([[1, 2], [4, 4]]))
t('rowRuns hàng rỗng không ra dải nào', rowRuns(row([0, 0]), 2).length === 0)
t('rowRuns dải chạm mép phải đóng đúng',
  JSON.stringify(rowRuns(row([1, 1]), 2)) === JSON.stringify([[0, 1]]))

const g = [row([1, 1, 0]), row([0, 0, 0]), row([0, 1, 1])]
t('gridRuns bỏ qua hàng rỗng và giữ đúng thứ tự hàng',
  JSON.stringify(gridRuns(g, 3, 3)) ===
  JSON.stringify([{ row: 0, c0: 0, c1: 1 }, { row: 2, c0: 1, c1: 2 }]))

// ── Thanh: vị trí và kích thước ────────────────────────────────────────────
const one = runsToShapes([{ row: 2, c0: 3, c1: 6 }], OPTS)
t('mỗi dải ra đúng một thanh', one.bars.length === 1)
t('thanh bắt đầu đúng cột', near(one.bars[0].x, 3 * CELL_W), `x=${one.bars[0].x}`)
t('thanh rộng đúng số cột phủ', near(one.bars[0].w, 4 * CELL_W), `w=${one.bars[0].w}`)
t('thanh cao hơn một hàng để hai hàng gối nhau',
  one.bars[0].h > CELL_H, `h=${one.bars[0].h} so với hàng ${CELL_H}`)
t('thanh nằm giữa hàng của nó',
  near(one.bars[0].y + one.bars[0].h / 2, 2.5 * CELL_H),
  `tâm=${one.bars[0].y + one.bars[0].h / 2}`)
t('một dải đứng lẻ không sinh hình thang', one.links.length === 0)

// ── Cốt lõi: biên xiên phải được VẠT, không còn bậc vuông ──────────────────
// Hai hàng kề nhau, hàng dưới lệch phải 5 cột — đúng kiểu biên gây răng cưa.
const SHIFT = 5
const slope = runsToShapes([
  { row: 0, c0: 0, c1: 9 },
  { row: 1, c0: SHIFT, c1: 9 + SHIFT },
], OPTS)

t('hai hàng kề nhau chồng lấn → có hình thang nối', slope.links.length === 1)

const [quad] = slope.links
const topY = quad[0].y
const botY = quad[3].y
t('hình thang chạy từ tâm hàng trên xuống tâm hàng dưới',
  near(topY, 0.5 * CELL_H) && near(botY, 1.5 * CELL_H), `${topY} → ${botY}`)
t('bước nhảy ngang được trải ra đúng một hàng, không dồn vào một điểm y',
  near(botY - topY, CELL_H), `cao ${botY - topY}px`)
t('cạnh trái dốc đúng bằng độ lệch giữa hai hàng',
  near(quad[3].x - quad[0].x, SHIFT * CELL_W), `lệch ${quad[3].x - quad[0].x}px`)

// Độ dốc của cạnh vạt: đây chính là con số thay cho "nhìn có mượt không".
const slopePxPerRow = Math.abs(quad[3].x - quad[0].x) / (botY - topY)
t('cạnh vạt là đường dốc hữu hạn, không phải bậc thẳng đứng',
  Number.isFinite(slopePxPerRow) && slopePxPerRow > 0,
  `${slopePxPerRow.toFixed(2)} px ngang / px dọc`)

// ── Không bắc cầu qua khoảng trống hay qua khe quá rộng ────────────────────
const gapRows = runsToShapes([{ row: 0, c0: 0, c1: 3 }, { row: 2, c0: 0, c1: 3 }], OPTS)
t('hàng cách hàng thì KHÔNG nối', gapRows.links.length === 0)

const farApart = runsToShapes([
  { row: 0, c0: 0, c1: 3 },
  { row: 1, c0: 3 + CFG.PREVIEW_CONNECT_GAP_CELLS + 2, c1: 20 },
], OPTS)
t('hai dải cách nhau quá ngưỡng thì KHÔNG dính làm một', farApart.links.length === 0)

const touching = runsToShapes([
  { row: 0, c0: 0, c1: 3 },
  { row: 1, c0: 4, c1: 8 },
], OPTS)
t('hai dải sát nhau vẫn được nối', touching.links.length === 1)

// ── Đầu vào chưa sắp theo hàng vẫn gom đúng ───────────────────────────────
const unsorted = runsToShapes([
  { row: 1, c0: 0, c1: 2 },
  { row: 0, c0: 0, c1: 2 },
], OPTS)
t('dải chưa sắp vẫn ra đủ thanh và hình thang',
  unsorted.bars.length === 2 && unsorted.links.length === 1)

// ── Tô loang và chế độ "Lưới" phải vẽ RA CÙNG MỘT HÌNH ────────────────────
// Đây là điều kiện chống tái phát: trước đây tô loang tự vẽ hình chữ nhật trần
// nên răng cưa, còn "Lưới" thì mượt, dù hai bên cùng một tập ô.
const rows = 40, cols = 60
const canvas = createEmptyGrid(rows, cols)
for (let r = 0; r < rows; r++) {          // vạch chéo chắn ngang, biên rất xiên
  const c = Math.min(cols - 1, Math.round(r * 1.3))
  canvas[r][c] = 1
}
const fill = floodFillRuns(canvas, 0, cols - 1)
const asFillShapes = runsToShapes(fill.runs, OPTS)
const asGridShapes = runsToShapes(
  gridRuns(stampRuns(createEmptyGrid(rows, cols), fill.runs, 1), rows, cols), OPTS)

t('tô loang và xem Lưới sinh cùng số thanh',
  asFillShapes.bars.length === asGridShapes.bars.length,
  `${asFillShapes.bars.length} vs ${asGridShapes.bars.length}`)
t('tô loang và xem Lưới sinh cùng số hình thang',
  asFillShapes.links.length === asGridShapes.links.length,
  `${asFillShapes.links.length} vs ${asGridShapes.links.length}`)
t('tô loang và xem Lưới trùng khít từng toạ độ',
  JSON.stringify(asFillShapes) === JSON.stringify(asGridShapes))

// Vùng tô có biên xiên thì gần như hàng nào cũng phải được vạt góc.
t('biên xiên được vạt ở hầu hết các hàng',
  asFillShapes.links.length >= rows - 2,
  `${asFillShapes.links.length} hình thang / ${rows} hàng`)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
