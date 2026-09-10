/** Thanh công cụ màn nước có lọt trong màn hình không?
 *
 *  Lỗi cũ: flex không wrap, tổng bề ngang các nút vượt 92vw trên điện thoại →
 *  Undo, Lưới, Xoá hết tràn ra ngoài mép phải và biến mất. Test này mô phỏng
 *  phép ngắt dòng của flex bằng số, lấy kích thước từ config chứ không gõ tay,
 *  nên đổi cỡ nút hay thêm nhóm công cụ là biết ngay có tràn hay không.
 */
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../src/waterfall/config.js'

const MAX_VW_FRACTION = 0.92   // maxWidth: '92vw' trong WaterfallTools
const PAD_X_MOBILE = 10        // padding: '8px 10px'
const ITEM_GAP = 4             // gap trong một nhóm

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const btn = UI.TOOLBAR_BTN_MOBILE_PX
const groupGap = UI.TOOLBAR_GROUP_GAP_PX
const group = (n) => n * btn + (n - 1) * ITEM_GAP

// Bốn nhóm trên mobile: bút/tẩy, cỡ nét, undo/redo, lưới/xoá.
const groups = [
  ['bút/tẩy', group(2)],
  ['cỡ nét', group(CFG.BRUSH_SIZES_PX.length)],
  ['undo/redo', group(2)],
  ['lưới/xoá', group(2)],
]

/** Ngắt dòng kiểu flex-wrap: nhóm nào không còn chỗ thì xuống dòng. */
function layout(avail) {
  const lines = []
  let line = 0
  for (const [, w] of groups) {
    const next = line === 0 ? w : line + groupGap + w
    if (next > avail && line > 0) { lines.push(line); line = w } else { line = next }
  }
  lines.push(line)
  return lines
}

t('mỗi nút vẫn đủ to để chạm (≥ 34px)', btn >= 34, `= ${btn}px`)
t('không nhóm nào rộng hơn 92vw của màn hẹp nhất',
  Math.max(...groups.map(([, w]) => w)) <= 320 * MAX_VW_FRACTION - 2 * PAD_X_MOBILE,
  `nhóm rộng nhất = ${Math.max(...groups.map(([, w]) => w))}px`)

for (const vw of [320, 360, 390, 430]) {
  const avail = vw * MAX_VW_FRACTION - 2 * PAD_X_MOBILE
  const lines = layout(avail)
  const widest = Math.max(...lines)
  t(`vừa màn ${vw}px`, widest <= avail,
    `dòng rộng nhất ${widest.toFixed(0)}px / ${avail.toFixed(0)}px, ${lines.length} dòng`)
}

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
