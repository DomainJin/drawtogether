/** Hình học của nét bút trên lưới van. Thuần tuý — không import UI, không đụng
 *  store, để test được bằng số.
 *
 *  Bán kính nhận theo TỪNG TRỤC (radRows, radCols) chứ không phải một số duy
 *  nhất: ô trên lưới không vuông trên màn hình (màn 4 m có 160 cột nhưng chỉ
 *  24–64 hàng, nên ô rất hẹp và cao). Người vẽ mong nét tròn theo những gì mắt
 *  thấy, nên caller quy đổi bán kính pixel ra số ô riêng cho mỗi trục.
 */

/** Bút mảnh hơn nửa ô vẫn phải tô được đúng ô nó đi qua, nếu không nét đứt
 *  quãng tuỳ vị trí lẻ của con trỏ. */
const MIN_RADIUS_CELLS = 0.5

/** Bước lấy mẫu dọc nét, đo trong không gian đã chuẩn hoá theo bán kính (bút
 *  thành hình tròn đơn vị). 0.25 nghĩa là hai vị trí bút liên tiếp chồng nhau
 *  rất nhiều — đủ để biên nét không gợn. */
const SAMPLE_STEP = 0.25
const MAX_SAMPLES = 4096

/** Mọi ô mà nét bút quét qua khi đi từ `from` tới `to`.
 *
 *  KHÔNG đóng dấu hình bút ở từng bước rồi hợp lại. Làm thế thì số ô mỗi hàng
 *  nhận được thay đổi theo vị trí lẻ của con trỏ và theo phép làm tròn — nét ra
 *  chỗ mỏng chỗ dày, biên gợn sóng.
 *
 *  Thay vào đó, với MỖI HÀNG tính khoảng cột [min, max] mà bút thực sự phủ tới
 *  trên suốt đường đi, rồi tô liền một dải. Mỗi hàng vì thế được đúng một dải
 *  liên tục, bề rộng biến thiên trơn theo hình học. Hai hàng kề nhau cũng luôn
 *  gối nhau vì hình quét là một khối lồi — nét liền cạnh, không chạm góc.
 *
 *  Toạ độ nhận dạng số thực để nét không giật theo lưới.
 */
export function strokeCells(from, to, radRows, radCols) {
  const rr = Math.max(radRows, MIN_RADIUS_CELLS)
  const cc = Math.max(radCols, MIN_RADIUS_CELLS)

  const dRow = to.row - from.row
  const dCol = to.col - from.col

  // Chiều dài nét đo trong không gian chuẩn hoá — bút to tự lấy ít mẫu, bút
  // nhỏ lấy nhiều, không phải đoán theo pixel.
  const length = Math.hypot(dRow / rr, dCol / cc)
  const samples = Math.min(MAX_SAMPLES, Math.max(1, Math.ceil(length / SAMPLE_STEP)))

  const loByRow = new Map()
  const hiByRow = new Map()

  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    const pr = from.row + dRow * t
    const pc = from.col + dCol * t

    const rStart = Math.ceil(pr - rr)
    const rEnd = Math.floor(pr + rr)
    for (let row = rStart; row <= rEnd; row++) {
      const d = (row - pr) / rr
      const k = 1 - d * d
      if (k < 0) continue
      // Nửa bề rộng của hình bút tại đúng hàng này.
      const half = cc * Math.sqrt(k)
      const lo = pc - half
      const hi = pc + half
      const curLo = loByRow.get(row)
      const curHi = hiByRow.get(row)
      if (curLo === undefined || lo < curLo) loByRow.set(row, lo)
      if (curHi === undefined || hi > curHi) hiByRow.set(row, hi)
    }
  }

  // Quy về khoảng cột nguyên cho từng hàng.
  const spans = [...loByRow.keys()]
    .sort((a, b) => a - b)
    .map((row) => ({ row, c0: Math.ceil(loByRow.get(row)), c1: Math.floor(hiByRow.get(row)) }))
    .filter((s) => s.c1 >= s.c0)

  // Chỗ bút cắt qua ranh giới hai hàng, bề rộng hình bút thu về gần 0, nên sau
  // khi ceil/floor hai hàng có thể lệch nhau đúng một cột và chỉ còn chạm góc.
  // Kéo giãn tối thiểu để hai hàng kề nhau luôn chung ít nhất một cột.
  for (let i = 1; i < spans.length; i++) {
    const prev = spans[i - 1]
    const cur = spans[i]
    if (cur.row !== prev.row + 1) continue
    if (cur.c0 > prev.c1) prev.c1 = cur.c0
    else if (prev.c0 > cur.c1) cur.c1 = prev.c0
  }

  const out = []
  for (const { row, c0, c1 } of spans) {
    for (let col = c0; col <= c1; col++) out.push({ row, col })
  }
  return out
}

/** Nét chấm tại một điểm (lúc vừa chạm xuống). */
export function pointCells(at, radRows, radCols) {
  return strokeCells(at, at, radRows, radCols)
}

/** Quy đổi bề dày nét (pixel trên màn) ra bán kính tính bằng số ô cho mỗi trục.
 *  Nhờ vậy nét trông tròn đúng như mắt thấy dù ô rất hẹp và cao. */
export function brushRadii(brushPx, cellWidthPx, cellHeightPx) {
  const radiusPx = brushPx / 2
  return {
    radCols: cellWidthPx > 0 ? radiusPx / cellWidthPx : 0,
    radRows: cellHeightPx > 0 ? radiusPx / cellHeightPx : 0,
  }
}
