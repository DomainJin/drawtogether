/** Cầu nối tới phần tử cuộn của khung vẽ.
 *
 *  Thanh cuộn và minimap nằm ngoài WaterfallCanvas nhưng cần ra lệnh cuộn cho
 *  nó. Giữ tham chiếu ở module thay vì đẩy qua nhiều tầng prop — cùng lối với
 *  getSocket() trong hooks/useSocket.js.
 */
let scroller = null

export function bindScroller(node) {
  scroller = node
}

export function getScroller() {
  return scroller
}

/** Cuộn tới vị trí tính theo TỈ LỆ 0..1 của phần cuộn được.
 *  Dùng tỉ lệ chứ không dùng pixel: minimap và thanh cuộn không cần biết
 *  chiều cao thật, và xoay máy xong tỉ lệ vẫn đúng. */
export function scrollToFraction(fraction) {
  if (!scroller) return
  const max = scroller.scrollHeight - scroller.clientHeight
  if (max <= 0) return
  scroller.scrollTop = Math.max(0, Math.min(1, fraction)) * max
}
