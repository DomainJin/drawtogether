/** Dock đáy trên điện thoại có đúng MỘT hàng, và hàng đó có lọt màn hình không?
 *
 *  Lỗi cũ hai lần liên tiếp đều ở chỗ này: lần đầu thanh công cụ không wrap
 *  nên Undo/Lưới/Xoá tràn ra ngoài mép phải và biến mất; chữa bằng wrap thì
 *  thành hai dòng, cộng với thanh trạng thái và nút "Gửi tới màn nước" cỡ lớn
 *  thành ba tầng ngốn gần một phần ba màn hình — chỗ vẽ chẳng còn bao nhiêu.
 *
 *  Lời giải hiện tại: công cụ cuộn ngang trong một hàng, hai nút hành động
 *  ghim cứng bên phải. Test này kiểm bằng số ba điều dễ hỏng lại:
 *   1. Chiều cao dock thật sự nhỏ hơn hẳn bố cục cũ.
 *   2. Nút hành động không bao giờ bị đẩy ra ngoài màn hình hẹp nhất.
 *   3. Phần cuộn còn đủ rộng để thấy ngay nhóm bút/tẩy/tô, không phải mò cuộn
 *      mới chọn được bút.
 *  Mọi kích thước lấy từ config, nên đổi cỡ nút hay thêm công cụ là biết ngay.
 */
import { WATERFALL_CONFIG as CFG, WATERFALL_UI as UI } from '../src/waterfall/config.js'

const ITEM_GAP = 4      // gap trong một nhóm (WaterfallToolRow)
const ACTION_GAP = 6    // gap giữa ⚙ và 🌊 (WaterfallDock)
const ACTION_PAD = 7    // paddingLeft 6 + vạch ngăn 1

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const btn = UI.TOOLBAR_BTN_MOBILE_PX
const group = (n) => n * btn + (n - 1) * ITEM_GAP

// Các nhóm trên dock, theo đúng thứ tự trong WaterfallToolRow.
const groups = [
  ['bút/tẩy/tô', group(3)],
  ['cỡ nét', group(CFG.BRUSH_SIZES_PX.length)],
  ['undo/redo', group(2)],
  ['lưới/xoá', group(2)],
]
const toolsWidth = groups.reduce((w, [, g]) => w + g, 0)
  + (groups.length - 1) * UI.TOOLBAR_GROUP_GAP_PX

/** Bề ngang cụm hành động ghim phải: ⚙ + 🌊. */
const actionsWidth = 2 * UI.DOCK_ACTION_BTN_PX + ACTION_GAP + ACTION_PAD

/** Bề ngang còn lại cho vùng cuộn trên màn rộng `vw`. */
const scrollWidth = (vw) =>
  vw - 2 * UI.DOCK_PAD_X_PX - UI.DOCK_GAP_PX - actionsWidth

// ── 1. Chỗ vẽ lấy lại được ────────────────────────────────────────────────
t('dock thấp hơn hẳn thanh thu gọn cũ',
  UI.DOCK_HEIGHT_PX < UI.SHEET_COLLAPSED_PX,
  `${UI.DOCK_HEIGHT_PX}px so với ${UI.SHEET_COLLAPSED_PX}px`)
t('dock chiếm dưới 12% chiều cao màn hình 667px',
  UI.DOCK_HEIGHT_PX / 667 < 0.12,
  `= ${(UI.DOCK_HEIGHT_PX / 667 * 100).toFixed(1)}%`)

// ── 2. Vùng chạm & nút ghim ───────────────────────────────────────────────
t('nút công cụ đủ to để chạm (≥ 40px)', btn >= 40, `= ${btn}px`)
t('nút hành động đủ to để chạm (≥ 44px)',
  UI.DOCK_ACTION_BTN_PX >= 44, `= ${UI.DOCK_ACTION_BTN_PX}px`)
t('nút gửi và ⚙ chỉ chiếm dưới nửa màn 320px',
  actionsWidth < 320 / 2, `= ${actionsWidth}px`)

// ── 3. Vùng cuộn ──────────────────────────────────────────────────────────
for (const vw of [320, 360, 390, 430]) {
  const avail = scrollWidth(vw)
  t(`màn ${vw}px: thấy ngay nhóm bút/tẩy/tô mà chưa cần cuộn`,
    avail >= groups[0][1],
    `vùng cuộn ${avail.toFixed(0)}px / nhóm đầu ${groups[0][1]}px`)
}
t('công cụ rộng hơn màn hẹp nhất → cuộn ngang là bắt buộc, không phải trang trí',
  toolsWidth > scrollWidth(320),
  `công cụ ${toolsWidth}px / vùng cuộn ${scrollWidth(320).toFixed(0)}px`)

// ── Desktop vẫn giữ pill wrap được, không nhóm nào tự nó tràn ─────────────
const btnD = UI.TOOLBAR_BTN_PX
const groupD = (n) => n * btnD + (n - 1) * ITEM_GAP
const widestD = Math.max(groupD(3), groupD(CFG.BRUSH_SIZES_PX.length), groupD(2))
t('desktop: nhóm rộng nhất vẫn lọt pill 92vw của cửa sổ 1024px',
  widestD <= 1024 * 0.92 - 24, `= ${widestD}px`)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
