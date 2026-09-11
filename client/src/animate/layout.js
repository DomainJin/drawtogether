/** Kích thước và chỗ đứng ban đầu của sprite trên lớp animation.
 *
 *  Lớp animation là canvas fixed phủ khung nhìn (toạ độ màn hình), còn vùng
 *  chọn đo bằng toạ độ canvas — phải nhân zoom mới ra cỡ "đúng như đang nhìn
 *  thấy". Sau đó hai chặn: nhỏ quá thì phóng cho thấy được, to quá thì thu lại.
 *  Thiếu chặn trên, chọn một vùng rộng lúc zoom sâu sinh ra sprite lớn hơn cả
 *  màn hình, bay đâu không rõ vì bốn mép đều nằm ngoài khung nhìn. */
import { ANIMATE_CONFIG as CFG } from './config.js'

export function computeSpriteBox({
  cropW, cropH, zoom, viewportW, viewportH,
  minPx = CFG.MIN_SPRITE_PX,
  maxRatio = CFG.MAX_SPRITE_VIEWPORT_RATIO,
}) {
  let w = cropW * zoom
  let h = cropH * zoom

  // Chặn dưới: cạnh NGẮN đạt minPx — hình thuôn dài (con cá, chiếc xe) mà đo
  // theo cạnh dài thì bề ngang còn vài pixel, nhìn như sợi chỉ.
  const up = Math.max(1, minPx / Math.max(1, Math.min(w, h)))
  w *= up; h *= up

  // Chặn trên: cạnh DÀI không quá maxRatio khung nhìn. Chặn này thắng chặn
  // dưới khi màn hình quá hẹp — lọt màn hình quan trọng hơn đủ to.
  const maxPx = Math.min(viewportW, viewportH) * maxRatio
  const down = Math.min(1, maxPx / Math.max(1, Math.max(w, h)))
  w *= down; h *= down

  return {
    w, h,
    x: viewportW / 2 - w / 2,
    y: viewportH / 2 - h / 2,
  }
}
