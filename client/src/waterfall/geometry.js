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

/** Hộp lớn nhất có tỉ lệ `aspect` nhét vừa vùng `boxW x boxH`, canh giữa. */
export function fitBox(boxW, boxH, aspect) {
  if (boxW <= 0 || boxH <= 0 || !Number.isFinite(aspect) || aspect <= 0) {
    return { width: boxW, height: boxH, left: 0, top: 0 }
  }
  let width = boxW
  let height = width / aspect
  if (height > boxH) {
    height = boxH
    width = height * aspect
  }
  return {
    width, height,
    left: (boxW - width) / 2,
    top: (boxH - height) / 2,
  }
}
