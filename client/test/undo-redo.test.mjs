import { useWaterfallStore as S } from '../src/store/waterfallStore.js'
import { strokeCells } from '../src/waterfall/brush.js'

const on = (g) => g.reduce((n, r) => n + r.reduce((a, v) => a + (v ? 1 : 0), 0), 0)
const st = () => S.getState()
let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const stroke = (tool, y0, y1) => {
  const px = 10, radRows = 1.4, radCols = 4.2
  st().beginStroke({ x: 0.45, y: y0 }, tool, px, radRows, radCols)
  st().extendStroke({ x: 0.55, y: y1 })
  // Tô đúng bằng đường mà rebuildGrid() sẽ dùng khi Undo/Redo dựng lại.
  const rows = st().rowCount, cols = st().cols
  const a = { col: 0.45 * cols, row: y0 * rows }
  const b = { col: 0.55 * cols, row: y1 * rows }
  st().paintCells(strokeCells(a, b, radRows, radCols), tool === 'pen')
}

st().clearGrid()
t('lưới rỗng lúc đầu', on(st().grid) === 0)
t('redoStack rỗng lúc đầu', st().redoStack.length === 0)

stroke('pen', 0.10, 0.20)
const afterA = on(st().grid)
stroke('pen', 0.60, 0.70)
const afterB = on(st().grid)
t('vẽ 2 nét → 2 strokes', st().strokes.length === 2)
t('nét 2 tô thêm ô', afterB > afterA, `${afterA} → ${afterB}`)

st().undoStroke()
t('undo bỏ 1 nét', st().strokes.length === 1)
t('undo trả lưới về sau nét 1', on(st().grid) === afterA, `${on(st().grid)} vs ${afterA}`)
t('undo đẩy vào redoStack', st().redoStack.length === 1)

st().redoStroke()
t('redo phục hồi nét', st().strokes.length === 2)
t('redo trả lưới về sau nét 2', on(st().grid) === afterB, `${on(st().grid)} vs ${afterB}`)
t('redo làm rỗng redoStack', st().redoStack.length === 0)

// Redo khi rỗng: không được đổi gì
st().redoStroke()
t('redo lúc rỗng là no-op', st().strokes.length === 2 && on(st().grid) === afterB)

// Undo hết rồi undo thêm
st().undoStroke(); st().undoStroke(); st().undoStroke()
t('undo quá tay dừng ở 0 nét', st().strokes.length === 0)
t('undo hết → lưới rỗng', on(st().grid) === 0)
t('redoStack giữ đúng 2 nét đã undo', st().redoStack.length === 2, `= ${st().redoStack.length}`)

// Vẽ nét mới phải bỏ nhánh redo
st().redoStroke()
stroke('pen', 0.30, 0.35)
t('vẽ mới xoá redoStack', st().redoStack.length === 0, `= ${st().redoStack.length}`)

// Tẩy: undo phải dựng lại được vùng đã tẩy (không trừ ngược được)
st().clearGrid()
stroke('pen', 0.10, 0.30)
const penOnly = on(st().grid)
stroke('eraser', 0.15, 0.20)
t('tẩy làm giảm số ô bật', on(st().grid) < penOnly, `${penOnly} → ${on(st().grid)}`)
st().undoStroke()
t('undo tẩy dựng lại đúng vùng cũ', on(st().grid) === penOnly, `${on(st().grid)} vs ${penOnly}`)
st().redoStroke()
t('redo tẩy xoá lại đúng vùng', on(st().grid) < penOnly)

// clearGrid dọn cả hai chồng
st().clearGrid()
t('clearGrid dọn strokes + redoStack', st().strokes.length === 0 && st().redoStack.length === 0)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
