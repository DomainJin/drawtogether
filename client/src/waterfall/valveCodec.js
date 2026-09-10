export const TS_CONFIG = 0xfffffffd
export const TS_RESET = 0xffffffff
export const TS_START = 0xfffffffe

export const FRAME_HEADER_BYTES = 4
export const CONFIG_FRAME_BYTES = 6

export function valveBytesFor(valveCount) {
  return Math.ceil(valveCount / 8)
}

export function packConfigFrame(valveCount) {
  const frame = new Uint8Array(CONFIG_FRAME_BYTES)
  const view = new DataView(frame.buffer)
  view.setUint32(0, TS_CONFIG >>> 0, true)
  view.setUint16(4, valveCount & 0xffff, true)
  return frame
}

export function packFrame(tsMs, bits) {
  const frame = new Uint8Array(FRAME_HEADER_BYTES + bits.length)
  new DataView(frame.buffer).setUint32(0, tsMs >>> 0, true)
  frame.set(bits, FRAME_HEADER_BYTES)
  return frame
}

export function valveBits(valves, B) {
  const buf = new Uint8Array(B)
  const maxValve = B * 8
  for (const v of valves) {
    if (v < 0 || v >= maxValve) continue
    buf[v >> 3] |= 1 << (7 - (v & 7))
  }
  return buf
}

function sameBits(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Dựng chuỗi frame cho một hoạ tiết.
 *
 *  Firmware GIỮ NGUYÊN trạng thái van cho tới khi nhận frame kế tiếp, nên phải
 *  sinh frame mỗi khi trạng thái ĐỔI — kể cả khi đổi thành toàn tắt.
 *
 *  Bản cũ bỏ qua mọi hàng trống (`if (bits.some(b => b !== 0))`), nên van của
 *  hàng có nét cuối cùng cứ mở tiếp cho tới frame tắt ở cuối hoạ tiết. Vẽ tới
 *  hàng 30 trong 64 hàng là van kẹt mở thêm 34 hàng — hơn 2,7 giây ở nhịp 80ms.
 *
 *  Đổi-mới-gửi cũng khiến các hàng giống hệt nhau gộp thành một frame, nên số
 *  frame còn ÍT hơn bản cũ với hoạ tiết có mảng đặc. */
export function buildAnimationFrames(rows, rowIntervalMs, valveCount, trimEmpty = false) {
  const B = valveBytesFor(valveCount)
  const frames = [
    packConfigFrame(valveCount),
    packFrame(TS_RESET, new Uint8Array(B)),
    packFrame(TS_START, new Uint8Array(B)),
  ]

  // Dải hàng thật sự có nội dung. Hàng trống ở hai đầu vẫn chiếm đủ thời gian
  // của nó, nên cắt đi rồi dịch mốc về 0 — xem TRIM_EMPTY_ROWS trong config.
  let first = 0
  let last = rows.length - 1
  if (trimEmpty) {
    while (first <= last && rows[first].length === 0) first++
    while (last >= first && rows[last].length === 0) last--
  }

  if (first > last) {
    // Lưới trống trơn: chỉ cần một frame tắt, không dựng cả hoạ tiết rỗng.
    frames.push(packFrame(0, new Uint8Array(B)))
    return frames
  }

  let prev = null
  for (let i = first; i <= last; i++) {
    const bits = valveBits(rows[i], B)
    if (prev && sameBits(prev, bits)) continue
    frames.push(packFrame((i - first) * rowIntervalMs, bits))
    prev = bits
  }

  // Luôn chốt bằng một frame tắt hết: hoạ tiết chạy xong thì van phải đóng,
  // không phụ thuộc hàng cuối có nét hay không.
  frames.push(packFrame((last - first + 1) * rowIntervalMs, new Uint8Array(B)))
  return frames
}

/** Lưới canvas -> danh sách van mở theo THỨ TỰ GỬI.
 *
 *  `bottomFirst` đảo trục dọc: xem EMIT_BOTTOM_ROW_FIRST trong config.js. Trục
 *  cột không đụng tới — van nào là van nấy.
 */
export function gridToOpenValveRows(grid, bottomFirst = false) {
  const ordered = bottomFirst ? [...grid].reverse() : grid
  return ordered.map((row) => {
    const open = []
    for (let c = 0; c < row.length; c++) {
      if (row[c]) open.push(c)
    }
    return open
  })
}
