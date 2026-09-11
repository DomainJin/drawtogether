/** Đổ hình do runGeometry tính ra vào một path của Canvas.
 *
 *  Ở lại thư mục component vì phụ thuộc Canvas API — waterfall/ giữ thuần tuý
 *  để test được bằng số. Phần hình học nằm hết bên runGeometry.js; ở đây chỉ
 *  còn việc gọi API vẽ.
 */

/** roundRect chỉ có từ Safari 16 — tự vẽ để máy cũ không mất luôn hoạ tiết. */
export function addRoundedRect(ctx, x, y, w, h, r) {
  const rad = Math.max(0, Math.min(r, w / 2, h / 2))
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, rad)
    return
  }
  ctx.moveTo(x + rad, y)
  ctx.arcTo(x + w, y, x + w, y + h, rad)
  ctx.arcTo(x + w, y + h, x, y + h, rad)
  ctx.arcTo(x, y + h, x, y, rad)
  ctx.arcTo(x, y, x + w, y, rad)
  ctx.closePath()
}

/** Thêm thanh và hình thang nối vào path HIỆN TẠI.
 *
 *  Không tự beginPath/fill: mọi hình phải nằm trong CÙNG một path rồi fill một
 *  lần. Fill từng hình một thì mối nối giữa thanh và hình thang lộ chỉ trắng do
 *  khử răng cưa — đúng thứ răng cưa mà cả cơ chế này sinh ra để xoá đi.
 */
export function addShapesToPath(ctx, { bars, links }) {
  for (const b of bars) addRoundedRect(ctx, b.x, b.y, b.w, b.h, b.r)

  for (const quad of links) {
    ctx.moveTo(quad[0].x, quad[0].y)
    for (let i = 1; i < quad.length; i++) ctx.lineTo(quad[i].x, quad[i].y)
    ctx.closePath()
  }
}
