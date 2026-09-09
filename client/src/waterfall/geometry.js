import { WATERFALL_CONFIG as CFG } from './config.js'

/** Hình học vật lý của màn nước. Thuần tuý, không đụng UI.
 *
 *  Chép đúng mô hình của waterfall-sprite (core/physical/computeGeometry.ts) —
 *  đó là nguồn sự thật cho phần vật lý, web chỉ được suy theo, không tự đặt số.
 *
 *  Màn nước hoạt động như một máy in dòng dựng đứng: mỗi hàng là một NHỊP THỜI
 *  GIAN, nước rơi mang nó xuống. Nên "chiều cao" của hoạ tiết không do số hàng
 *  quyết định mà do nước rơi được bao xa trong từng ấy nhịp.
 */

/** Thời gian một giọt rơi hết chiều cao màn (ms): t = sqrt(2h/g). */
export function fallTimeMs(curtainHeightM = CFG.CURTAIN_HEIGHT_M) {
  return Math.sqrt((2 * curtainHeightM) / CFG.GRAVITY_M_S2) * 1000
}

/** Số hàng cùng nhìn thấy trên màn tại một thời điểm. Hàng mới nhất ở trên. */
export function visibleRows(rowIntervalMs, curtainHeightM = CFG.CURTAIN_HEIGHT_M) {
  return Math.max(1, Math.floor(fallTimeMs(curtainHeightM) / rowIntervalMs))
}

/** Khoảng cách ngang giữa hai van (mm). */
export function mmPerCol(valvesPerMeter = CFG.VALVES_PER_METER) {
  return 1000 / valvesPerMeter
}

/** Khoảng cách dọc TRUNG BÌNH giữa hai hàng (mm).
 *
 *  Trung bình, vì nước tăng tốc nên khoảng cách thật không đều: với nhịp 80ms
 *  và màn cao 2m, hai hàng cách nhau 31mm ở ngay dưới vòi nhưng tới 469mm ở
 *  sát đáy. Lấy trung bình là xấp xỉ hợp lý nhất cho một tỉ lệ khung cố định.
 */
export function mmPerRow(rowIntervalMs, curtainHeightM = CFG.CURTAIN_HEIGHT_M) {
  return (curtainHeightM * 1000) / visibleRows(rowIntervalMs, curtainHeightM)
}

/** Tỉ lệ khung (rộng chia cao) của cả hoạ tiết khi nó chạy trên màn nước.
 *  Canvas vẽ lấy đúng tỉ lệ này thì nét tròn trên màn hình mới tròn ngoài đời. */
export function patternAspect({ cols, rowCount, rowIntervalMs, valvesPerMeter, curtainHeightM }) {
  const widthMm = cols * mmPerCol(valvesPerMeter)
  const heightMm = rowCount * mmPerRow(rowIntervalMs, curtainHeightM)
  return heightMm > 0 ? widthMm / heightMm : 1
}

/** Kích thước canvas khi cho vừa BỀ NGANG vùng vẽ và giữ nguyên tỉ lệ.
 *
 *  Không lồng vừa cả chiều cao: hoạ tiết 64 hàng ở nhịp 80ms có tỉ lệ 1:4.57,
 *  ép vừa chiều cao màn hình dọc thì còn một dải hẹp không vẽ nổi. Cho tràn
 *  chiều cao rồi cuộn vẫn giữ đúng tỉ lệ mà vùng vẽ rộng gấp mấy lần.
 */
export function canvasSizeForWidth(boxWidth, aspect) {
  const width = Math.max(0, boxWidth)
  if (!Number.isFinite(aspect) || aspect <= 0) return { width, height: width }
  return { width, height: width / aspect }
}

/** Giới hạn an toàn cho một canvas — vượt là trình duyệt trả về canvas trắng.
 *  Safari trên iOS đời cũ chặn ở cạnh 4096px, và bộ nhớ mới là ràng buộc thật:
 *  strokeRenderer giữ thêm 2 canvas đệm cùng cỡ. */
const MAX_CANVAS_SIDE_PX = 4096
const MAX_CANVAS_AREA_PX = 4e6

/** Hệ số nhân mật độ điểm, đã hạ xuống nếu canvas quá lớn.
 *
 *  Hoạ tiết càng cao (nhịp rơi càng chậm) canvas càng dài; nhân thẳng
 *  devicePixelRatio trên máy retina là vượt giới hạn ngay.
 *
 *  Có thể trả về số NHỎ HƠN 1: ở nhịp rơi chậm nhất, hoạ tiết cao tới ~6800px
 *  CSS, tự nó đã vượt cạnh 4096px rồi. Lúc đó buộc phải vẽ ở độ phân giải thấp
 *  hơn kích thước hiển thị — nét hơi mềm, nhưng còn hơn mất trắng cả bản vẽ. */
export function renderScale(cssWidth, cssHeight, dpr) {
  const w = Math.max(1, cssWidth)
  const h = Math.max(1, cssHeight)
  const bySide = MAX_CANVAS_SIDE_PX / Math.max(w, h)
  const byArea = Math.sqrt(MAX_CANVAS_AREA_PX / (w * h))
  return Math.max(0.05, Math.min(dpr, bySide, byArea))
}
