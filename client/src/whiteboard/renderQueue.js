/** Hàng đợi vẽ lên canvas bảng chung — giữ ĐÚNG THỨ TỰ khi có ảnh.
 *
 *  Nét vẽ thì vẽ đồng bộ được, còn ảnh phải chờ giải mã. Vẽ lịch sử bằng
 *  forEach như trước thì ảnh giải mã xong SAU cùng và đè lên mọi nét người
 *  khác đã vẽ trên nó — đúng thứ người dùng upload ảnh để vẽ lên. Mọi thao tác
 *  từ xa (stroke, ảnh, xoá bảng) đi qua một chuỗi promise duy nhất.
 *
 *  Nét của CHÍNH mình vẫn vẽ trực tiếp khi đang kéo bút (cần phản hồi tức
 *  thì), không qua hàng đợi. */
import { loadImageElement } from './imageEncode.js'
import { pointsToRect } from './imagePlacement.js'

let tail = Promise.resolve()

/** Xếp một việc vẽ (có thể async) vào sau các việc trước. Lỗi của một việc
 *  không làm gãy cả chuỗi — ảnh hỏng thì bỏ ảnh đó, nét sau vẫn vẽ. */
export function enqueueRender(task) {
  tail = tail.then(task).catch((err) => console.error('[render]', err))
  return tail
}

export function drawImageStroke(ctx, stroke, img) {
  const r = pointsToRect(stroke.points)
  ctx.save()
  ctx.globalAlpha = stroke.opacity ?? 1
  ctx.drawImage(img, r.x, r.y, r.w, r.h)
  ctx.restore()
}

/** Vẽ một stroke bất kỳ qua hàng đợi. `renderStroke` truyền vào để file này
 *  không phụ thuộc ngược vào hook socket. */
export function enqueueStroke(getCtx, stroke, renderStroke) {
  return enqueueRender(async () => {
    if (stroke.tool === 'image') {
      if (!stroke.src || !stroke.points?.length) return
      const img = await loadImageElement(stroke.src)
      const ctx = getCtx()
      if (ctx) drawImageStroke(ctx, stroke, img)
      return
    }
    const ctx = getCtx()
    if (ctx) renderStroke(ctx, stroke)
  })
}
