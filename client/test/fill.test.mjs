/** Tô loang trên lưới van — kiểm bằng SỐ, không bằng mắt.
 *
 *  Dựng lưới nhân tạo (khung kín, khe hở góc, vùng chạm mép) rồi đếm ô bật ở
 *  đầu ra: mắt nhìn canvas không phân biệt được "tràn qua khe góc" với "tô
 *  đúng vùng kín", còn số thì có.
 */
import { floodFillRuns, runsCellCount } from '../src/waterfall/fill.js'
import { createEmptyGrid, stampRuns } from '../src/waterfall/grid.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const on = (g) => g.reduce((n, r) => n + r.reduce((a, v) => a + (v ? 1 : 0), 0), 0)

/** Lưới từ chuỗi ASCII: '#' = van mở, '.' = đóng. */
const fromArt = (art) => art.trim().split('\n').map((line) => {
  const row = new Uint8Array(line.trim().length)
  ;[...line.trim()].forEach((ch, i) => { row[i] = ch === '#' ? 1 : 0 })
  return row
})

const apply = (grid, r, c) => {
  const f = floodFillRuns(grid, r, c)
  return { ...f, grid: stampRuns(grid, f.runs, f.value) }
}

// ── Ô trống trong khung kín: tô đầy đúng phần bên trong ─────────────────────
const box = fromArt(`
#####
#...#
#...#
#####
`)
t('lưới mẫu có 14 ô bật', on(box) === 14, `= ${on(box)}`)

const filled = apply(box, 1, 2)
t('chạm vùng trống → tô về 1', filled.value === 1)
t('tô đúng 6 ô bên trong', runsCellCount(filled.runs) === 6, `= ${runsCellCount(filled.runs)}`)
t('sau khi tô lưới đầy kín', on(filled.grid) === 20, `= ${on(filled.grid)}`)

// ── Chạm vào mảng đã vẽ: xoá cả mảng ───────────────────────────────────────
const erased = apply(filled.grid, 0, 0)
t('chạm mảng đã vẽ → tô về 0', erased.value === 0)
t('xoá sạch cả mảng liền nhau', on(erased.grid) === 0, `= ${on(erased.grid)}`)

// ── Không loang chéo: khe hở góc KHÔNG cho mực đi qua ───────────────────────
// Hai buồng trống chỉ chạm nhau ở góc (hàng 1 cột 2 / hàng 2 cột 3).
const corner = fromArt(`
#######
#..####
###..##
#######
`)
const cornerFill = apply(corner, 1, 1)
t('khe góc không cho mực tràn sang buồng kia',
  runsCellCount(cornerFill.runs) === 2, `tô ${runsCellCount(cornerFill.runs)} ô, phải là 2`)

// ── Vùng trống hở ra mép thì tô hết phần nền ────────────────────────────────
const open = fromArt(`
.....
..#..
.....
`)
const openFill = apply(open, 0, 0)
t('nền hở mép tô hết 14 ô còn lại',
  runsCellCount(openFill.runs) === 14, `= ${runsCellCount(openFill.runs)}`)
t('ô đã bật không bị đụng tới', openFill.grid[1][2] === 1)

// ── Biên & đầu vào xấu ─────────────────────────────────────────────────────
t('chạm ngoài lưới trả null', floodFillRuns(box, -1, 0) === null)
t('chạm quá cột cuối trả null', floodFillRuns(box, 0, 99) === null)
t('lưới rỗng trả null', floodFillRuns([], 0, 0) === null)

// ── Lưới thật: 160 × 256 toàn trống, tô một phát phải phủ trọn ─────────────
const big = createEmptyGrid(256, 160)
const bigFill = apply(big, 128, 80)
t('tô cả lưới 160×256 phủ đủ 40960 ô',
  runsCellCount(bigFill.runs) === 160 * 256, `= ${runsCellCount(bigFill.runs)}`)
t('mỗi hàng gom đúng một dải', bigFill.runs.length === 256, `= ${bigFill.runs.length} dải`)
t('lưới sau khi tô bật hết', on(bigFill.grid) === 160 * 256)

// ── stampRuns không đụng ô ngoài dải, và giữ tính bất biến ─────────────────
const src = createEmptyGrid(3, 5)
const out = stampRuns(src, [{ row: 1, c0: 1, c1: 3 }], 1)
t('stampRuns tô đúng 3 ô', on(out) === 3, `= ${on(out)}`)
t('stampRuns không sửa lưới cũ', on(src) === 0)
t('stampRuns cắt dải thừa ngoài mép',
  on(stampRuns(src, [{ row: 0, c0: -4, c1: 99 }], 1)) === 5)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
