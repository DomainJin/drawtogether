/** Hình học của nét bút trên lưới van. Thuần tuý — không import UI, không đụng
 *  store, để test được bằng số.
 *
 *  Bán kính nhận theo TỪNG TRỤC (radRows, radCols) chứ không phải một số duy
 *  nhất: ô trên lưới không vuông trên màn hình (màn 4 m có 160 cột nhưng chỉ
 *  24–64 hàng, nên ô rất hẹp và cao). Người vẽ mong nét tròn theo những gì mắt
 *  thấy, nên caller quy đổi bán kính pixel ra số ô riêng cho mỗi trục.
 */

/** Các ô nằm trong hình ellipse tâm (row, col). Ghi thẳng vào `out`/`seen` để
 *  một nét dài không phải cấp phát mảng trung gian cho từng điểm. */
function stampEllipse(row, col, radRows, radCols, out, seen) {
  const spanR = Math.floor(radRows)
  const spanC = Math.floor(radCols)

  // Bán kính dưới 1 ô: chỉ tô đúng ô dưới con trỏ, không nở ra hàng xóm.
  const rr = Math.max(radRows, 0.5)
  const cc = Math.max(radCols, 0.5)

  for (let dr = -spanR; dr <= spanR; dr++) {
    for (let dc = -spanC; dc <= spanC; dc++) {
      if ((dr * dr) / (rr * rr) + (dc * dc) / (cc * cc) > 1) continue
      const r = row + dr
      const c = col + dc
      const key = r * 100000 + c
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ row: r, col: c })
    }
  }
}

/** Mọi ô mà nét bút quét qua khi đi từ `from` tới `to`.
 *
 *  Nội suy giữa hai điểm là phần bắt buộc: pointermove chỉ lấy mẫu rời rạc,
 *  mà một cột trên điện thoại chỉ rộng ~2,4px — kéo tay nhanh là nhảy qua hàng
 *  chục ô, nét vẽ ra đứt quãng. Số bước lấy theo trục lệch nhiều hơn để không
 *  bỏ sót ô nào.
 *
 *  Toạ độ nhận dạng số thực (vị trí ô có phần lẻ) để nét không bị giật theo
 *  lưới; chỉ làm tròn ở từng bước.
 */
export function strokeCells(from, to, radRows, radCols) {
  const dRow = to.row - from.row
  const dCol = to.col - from.col
  const steps = Math.max(Math.abs(dRow), Math.abs(dCol), 0)
  const count = Math.max(1, Math.ceil(steps))

  const out = []
  const seen = new Set()

  for (let i = 0; i <= count; i++) {
    const t = i / count
    stampEllipse(
      Math.round(from.row + dRow * t),
      Math.round(from.col + dCol * t),
      radRows, radCols, out, seen,
    )
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
