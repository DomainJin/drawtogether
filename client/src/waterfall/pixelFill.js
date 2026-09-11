/** Tô loang ở KHÔNG GIAN MÀN HÌNH, trên đệm RGBA. Thuần tuý — không Canvas,
 *  không UI: nhận thẳng mảng pixel nên kiểm được bằng số.
 *
 *  Vì sao phải có cái này trong khi đã có tô loang trên lưới (fill.js):
 *
 *  Lưới van chỉ 160 cột × vài trăm hàng, nên một ô to bằng cả chục pixel trên
 *  màn. Nét bút hiển thị là VECTOR mượt ở độ phân giải màn hình, còn dấu chân
 *  của nó trên lưới thì béo hơn thế — làm tròn ra ngoài tới cả một ô mỗi bên.
 *  Tô loang trên lưới dừng lại ở mép dấu chân ấy, nên trên màn hiện ra một
 *  viền trắng giữa vùng tô và nét bút: "tô chưa đủ".
 *
 *  Cách chữa giống hệt cách đã dùng cho NÉT BÚT: hiển thị ở độ phân giải màn
 *  hình, còn lưới vẫn là nguồn sự thật cho thứ gửi đi. Vùng tô vì thế ăn sát
 *  vào đúng đường vector đang nhìn thấy, không còn khe hở.
 *
 *  Lưới KHÔNG đổi — thuật toán tô trên lưới giữ nguyên. Hai bên lệch nhau đúng
 *  phần làm tròn của lưới, và nút "Lưới" vẫn cho xem chính xác thứ sẽ gửi.
 */

/** Pixel phủ từ nửa trở lên coi như ĐẶC. Cùng quy ước với lưới: ô được nét
 *  quét qua quá nửa thì tính là van mở. */
export const ALPHA_SOLID = 128

/** Số vòng "nuốt" viền khử răng cưa quanh vùng vừa tô.
 *
 *  Không nuốt thì còn lại một sợi xám tóc: các pixel ở rìa nét có alpha khoảng
 *  0,5 nằm kẹp giữa hai mảng đen đặc, nhìn ra một đường viền nhạt bên trong
 *  hình. Một vòng là vừa đủ cho dải khử răng cưa ~1px của Canvas. Nhiều vòng
 *  hơn thì với nét mảnh nhất (4px) có thể nuốt xuyên sang rìa NGOÀI, làm nét
 *  trông béo ra — nên dừng ở 1. */
export const FRINGE_PASSES = 1

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Tô loang từ một pixel mầm.
 *
 * @param {Uint8ClampedArray|Uint8Array} data  đệm RGBA, dài width*height*4
 * @param {number} width
 * @param {number} height
 * @param {number} seedX
 * @param {number} seedY
 * @param {object} opts
 * @param {boolean} opts.solid  true = đổ đầy vùng trống; false = xoá một mảng đặc
 * @param {[number,number,number]} opts.color  màu tô khi solid
 * @param {number} [opts.fringePasses]
 * @param {number} [opts.alphaSolid]
 * @param {number} [opts.maxPixels]  trần diện tích; vượt là coi như mực đã
 *        thoát ra ngoài hình, bỏ dở và KHÔNG đụng vào `data`
 * @returns {number} số pixel đã đổi, hoặc -1 khi không tô được (mầm không hợp
 *          lệ, hoặc vùng tô vượt trần) — caller nên quay về cách vẽ từ lưới.
 */
export function floodFillPixels(data, width, height, seedX, seedY, opts) {
  const w = Math.floor(width)
  const h = Math.floor(height)
  if (w <= 0 || h <= 0) return -1
  if (data.length < w * h * 4) return -1

  const {
    solid, color = [26, 26, 26],
    fringePasses = FRINGE_PASSES,
    alphaSolid = ALPHA_SOLID,
    maxPixels = Infinity,
  } = opts

  const isSolid = (i) => data[i * 4 + 3] >= alphaSolid
  // Đổ đầy thì đi qua chỗ TRỐNG và dừng ở nét; xoá mảng thì ngược lại.
  const passable = solid ? (i) => !isSolid(i) : isSolid

  const x0 = clamp(Math.round(seedX), 0, w - 1)
  const y0 = clamp(Math.round(seedY), 0, h - 1)
  if (!passable(y0 * w + x0)) return -1

  const mask = new Uint8Array(w * h)
  let filled = 0

  // Scanline: mỗi lần lấy ra một điểm thì nới hết cỡ sang hai bên rồi mới xét
  // hai hàng kề. Stack phẳng (x, y xen kẽ) để không tạo hàng triệu object.
  const stack = [x0, y0]
  while (stack.length) {
    const y = stack.pop()
    const x = stack.pop()
    const base = y * w
    if (mask[base + x] || !passable(base + x)) continue

    let xL = x
    while (xL > 0 && !mask[base + xL - 1] && passable(base + xL - 1)) xL--
    let xR = x
    while (xR + 1 < w && !mask[base + xR + 1] && passable(base + xR + 1)) xR++
    for (let xx = xL; xx <= xR; xx++) mask[base + xx] = 1
    filled += xR - xL + 1
    // Vượt trần nghĩa là nét bao bị hở và mực đã chảy ra nền. Bỏ dở TRƯỚC khi
    // ghi vào `data`, để caller còn vẽ lại được từ lưới.
    if (filled > maxPixels) return -1

    for (const ny of [y - 1, y + 1]) {
      if (ny < 0 || ny >= h) continue
      const nbase = ny * w
      // Chỉ đẩy ô ĐẦU mỗi đoạn liền nhau; phần còn lại scanline gom nốt.
      let inRun = false
      for (let xx = xL; xx <= xR; xx++) {
        const ok = !mask[nbase + xx] && passable(nbase + xx)
        if (ok && !inRun) { stack.push(xx, ny); inRun = true }
        else if (!ok) inRun = false
      }
    }
  }

  absorbFringe(data, mask, w, h, fringePasses)

  let changed = 0
  const [r, g, b] = color
  for (let i = 0; i < w * h; i++) {
    if (!mask[i]) continue
    const p = i * 4
    if (solid) {
      data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255
    } else {
      data[p] = 0; data[p + 1] = 0; data[p + 2] = 0; data[p + 3] = 0
    }
    changed++
  }
  return changed
}

/** Nới vùng tô sang các pixel rìa khử răng cưa nằm sát nó (alpha lẻ, không đặc
 *  hẳn cũng không trống hẳn). Chỉ nới vào chỗ ĐÃ có mực, nên không thể tràn qua
 *  lõi đặc của nét. Mỗi vòng chụp lại mặt nạ trước khi nới, để số vòng đúng là
 *  số pixel nới ra chứ không lan dây chuyền. */
function absorbFringe(data, mask, w, h, passes) {
  for (let pass = 0; pass < passes; pass++) {
    const before = mask.slice()
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (before[i]) continue
        const a = data[i * 4 + 3]
        if (a === 0 || a === 255) continue
        const up = y > 0 && before[i - w]
        const down = y + 1 < h && before[i + w]
        const left = x > 0 && before[i - 1]
        const right = x + 1 < w && before[i + 1]
        if (up || down || left || right) mask[i] = 1
      }
    }
  }
}
