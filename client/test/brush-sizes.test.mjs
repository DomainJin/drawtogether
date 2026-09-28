// Cỡ nét: thêm 2 cấp lớn, và chấm xem trước phải phân biệt được MỌI cỡ.
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../src/waterfall/config.js'
import { brushDotPx } from '../src/waterfall/brushPreview.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const sizes = CFG.BRUSH_SIZES_PX
t('có 6 cấp cỡ nét', sizes.length === 6, sizes.join(','))
t('tăng dần, không trùng', sizes.every((v, i) => i === 0 || v > sizes[i - 1]))
t('2 cấp mới lớn hơn cấp lớn nhất cũ (34)', sizes.filter((v) => v > 34).length === 2)
t('cỡ mặc định nằm trong danh sách', sizes.includes(CFG.DEFAULT_BRUSH_PX))

for (const btn of [UI.TOOLBAR_BTN_PX, UI.TOOLBAR_BTN_MOBILE_PX]) {
  const dots = sizes.map((px) => brushDotPx(px, btn))
  t(`nút ${btn}px: chấm tăng dần, không cỡ nào trùng chấm`,
    dots.every((d, i) => i === 0 || d > dots[i - 1]), dots.join(','))
  t(`nút ${btn}px: chấm lớn nhất vừa trong nút (chừa 6px mỗi bên)`, Math.max(...dots) <= btn - 12)
  t(`nút ${btn}px: chấm nhỏ nhất vẫn nhìn thấy (≥ 4px)`, Math.min(...dots) >= 4)
}

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All brush-sizes tests passed')
