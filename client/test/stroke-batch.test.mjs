// extendStrokeBatch (gộp theo khung hình) phải cho ra ĐÚNG lưới + nét như gọi
// extendStroke/paintCells từng sự kiện một — chỉ đổi số lần set, không đổi kết quả.
import { useWaterfallStore as S } from '../src/store/waterfallStore.js'
import { strokeCells } from '../src/waterfall/brush.js'

const st = () => S.getState()
let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const radRows = 1.4, radCols = 4.2
// Nét dích dắc nhanh: nhiều điểm, đổi hướng liên tục.
const path = Array.from({ length: 40 }, (_, i) => ({ x: 0.1 + (i % 2) * 0.7, y: 0.05 + i * 0.02 }))
const toCell = (p) => ({ col: p.x * st().cols, row: p.y * st().rowCount })

function drawSequential(tool) {
  st().clearGrid()
  st().beginStroke(path[0], tool, 10, radRows, radCols)
  for (let i = 1; i < path.length; i++) {
    st().extendStroke(path[i])
    st().paintCells(strokeCells(toCell(path[i - 1]), toCell(path[i]), radRows, radCols), tool === 'eraser' ? 0 : 1)
  }
  return { grid: st().grid.map((r) => r.join('')).join('\n'), points: st().strokes.at(-1).points }
}

function drawBatched(tool, perFrame) {
  st().clearGrid()
  st().beginStroke(path[0], tool, 10, radRows, radCols)
  let sets = 0
  const unsub = S.subscribe(() => sets++)
  for (let i = 1; i < path.length; i += perFrame) {
    const pts = [], cells = []
    for (let j = i; j < Math.min(i + perFrame, path.length); j++) {
      pts.push(path[j])
      cells.push(...strokeCells(toCell(path[j - 1]), toCell(path[j]), radRows, radCols))
    }
    st().extendStrokeBatch(pts, cells, tool === 'eraser' ? 0 : 1)
  }
  unsub()
  return { grid: st().grid.map((r) => r.join('')).join('\n'), points: st().strokes.at(-1).points, sets }
}

const seq = drawSequential('pen')
for (const perFrame of [1, 3, 4, 39]) {
  const b = drawBatched('pen', perFrame)
  t(`gộp ${perFrame} sự kiện/khung: lưới giống hệt`, b.grid === seq.grid)
  t(`gộp ${perFrame} sự kiện/khung: điểm nét giống hệt`, JSON.stringify(b.points) === JSON.stringify(seq.points),
    `${b.points.length} điểm`)
  t(`gộp ${perFrame} sự kiện/khung: số lần set = số khung`, b.sets === Math.ceil((path.length - 1) / perFrame), `${b.sets} set`)
}

const ink = seq.grid.split('').filter((c) => c === '1').length
t('nét thật sự tô được ô', ink > 0, `${ink} ô`)

st().clearGrid()
st().extendStrokeBatch([{ x: 0.5, y: 0.5 }], [], 1)
t('không có nét nào thì batch là no-op', st().strokes.length === 0)

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All stroke-batch tests passed')
