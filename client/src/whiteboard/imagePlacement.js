/** Hình học và ngân sách nén cho ảnh upload — thuần tính toán, không DOM.
 *
 *  Mọi toạ độ ở đây là toạ độ BẢNG VẼ (0..CANVAS_SIZE), không phải px màn
 *  hình. Chỗ dễ sai nhất của tính năng này là quy đổi giữa hai hệ khi đang
 *  zoom/pan: kéo chuột 100px ở zoom 29% là dời ảnh 345px trên bảng. Tách ra để
 *  test bằng số thay vì kéo thử bằng tay ở từng mức zoom. */
import { IMAGE_CONFIG as CFG, WHITEBOARD_CONFIG as WB } from './config.js'

/** null nếu nhận được, hoặc câu báo lỗi cho người dùng. */
export function validateImageFile(file, cfg = CFG) {
  if (!file) return 'Không có file nào'
  if (!cfg.ACCEPT_TYPES.includes(file.type)) {
    return `Không hỗ trợ định dạng ${file.type || 'này'} — dùng PNG, JPEG, WebP, GIF hoặc BMP`
  }
  if (file.size > cfg.MAX_FILE_BYTES) {
    const mb = (n) => (n / 1024 / 1024).toFixed(0)
    return `Ảnh ${mb(file.size)}MB quá lớn (tối đa ${mb(cfg.MAX_FILE_BYTES)}MB)`
  }
  return null
}

/** Thu (w, h) để cạnh dài nhất không vượt maxPx. Không phóng to. Trả số nguyên
 *  ≥ 1 vì kích thước canvas phải nguyên. */
export function scaleToFit(w, h, maxPx) {
  const k = Math.min(1, maxPx / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

/** Vùng bảng vẽ đang nằm trong khung nhìn.
 *  cam.x/y là offset (px màn hình) của góc bảng, zoom là tỉ lệ — đúng quy ước
 *  transform `translate(x,y) scale(zoom)` của WhiteboardPage. */
export function viewportInCanvas(cam, viewW, viewH) {
  return {
    x: -cam.x / cam.zoom,
    y: -cam.y / cam.zoom,
    w: viewW / cam.zoom,
    h: viewH / cam.zoom,
  }
}

/** Giữ khung nằm trọn trong bảng. Khung to hơn bảng thì thu lại giữ tỉ lệ
 *  trước — dời thôi thì không bao giờ lọt. */
export function clampRectToBoard(rect, board = WB.CANVAS_SIZE) {
  let { w, h } = rect
  const k = Math.min(1, board / w, board / h)
  w *= k; h *= k
  return {
    x: Math.min(Math.max(0, rect.x), board - w),
    y: Math.min(Math.max(0, rect.y), board - h),
    w, h,
  }
}

/** Chỗ đặt ban đầu: giữa khung nhìn, chiếm INITIAL_VIEW_RATIO khung nhìn, giữ
 *  tỉ lệ ảnh, không phóng ảnh nhỏ to hơn cỡ thật (ảnh 200px phóng lên 2000px
 *  thì vỡ hạt, người dùng tự kéo to nếu muốn). */
export function fitImageToView(imgW, imgH, view, ratio = CFG.INITIAL_VIEW_RATIO, board = WB.CANVAS_SIZE) {
  const k = Math.min(1, (view.w * ratio) / imgW, (view.h * ratio) / imgH)
  const w = imgW * k
  const h = imgH * k
  return clampRectToBoard({
    x: view.x + (view.w - w) / 2,
    y: view.y + (view.h - h) / 2,
    w, h,
  }, board)
}

/** Dời khung theo độ lệch px MÀN HÌNH. */
export function moveRect(rect, dxScreen, dyScreen, zoom, board = WB.CANVAS_SIZE) {
  return clampRectToBoard({
    ...rect,
    x: rect.x + dxScreen / zoom,
    y: rect.y + dyScreen / zoom,
  }, board)
}

/** Kéo góc dưới-phải, giữ tỉ lệ ảnh.
 *
 *  Chiếu độ lệch lên trục nào kéo được NHIỀU hơn (theo tỉ lệ): kéo chéo lệch
 *  tay một chút vẫn đổi cỡ mượt, không giật giữa hai trục. Góc trên-trái đứng
 *  yên — đó là điểm neo người dùng vừa căn. */
export function resizeFromCorner(rect, dxScreen, dyScreen, zoom, opts = {}) {
  const minPx = opts.minPx ?? CFG.MIN_PLACED_PX
  const board = opts.board ?? WB.CANVAS_SIZE
  const aspect = rect.w / rect.h

  const byW = rect.w + dxScreen / zoom
  const byH = (rect.h + dyScreen / zoom) * aspect
  let w = Math.abs(byW - rect.w) >= Math.abs(byH - rect.w) ? byW : byH

  // Chặn dưới theo cạnh NGẮN, chặn trên theo phần bảng còn lại từ điểm neo.
  const minW = aspect >= 1 ? minPx * aspect : minPx
  const maxW = Math.min(board - rect.x, (board - rect.y) * aspect)
  w = Math.min(Math.max(w, minW), maxW)

  return { x: rect.x, y: rect.y, w, h: w / aspect }
}

/** Khung ↔ 2 góc — dạng lưu trong stroke (points), để server và renderer cũ
 *  vẫn thấy một stroke có ≥ 2 điểm. */
export function rectToPoints(rect) {
  const r = (n) => Math.round(n * 10) / 10
  return [
    { x: r(rect.x), y: r(rect.y) },
    { x: r(rect.x + rect.w), y: r(rect.y + rect.h) },
  ]
}

export function pointsToRect(points) {
  const [a, b] = points
  return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }
}

/** Nén ảnh cho vừa ngân sách ký tự.
 *
 *  `encode(w, h, quality)` do phía trình duyệt cung cấp (vẽ canvas + toDataURL)
 *  — tách ra để thuật toán dò nấc chạy được trong Node với encoder giả.
 *  Trả null khi thu tới MIN_DIMENSION_PX mà vẫn không vừa: báo lỗi còn hơn gửi
 *  một ảnh mờ tới mức không dùng để vẽ theo được. */
export function encodeWithinBudget(encode, srcW, srcH, cfg = CFG) {
  let dims = scaleToFit(srcW, srcH, cfg.MAX_DIMENSION_PX)
  let attempts = 0
  for (;;) {
    for (const q of cfg.JPEG_QUALITIES) {
      attempts++
      const src = encode(dims.w, dims.h, q)
      if (src.length <= cfg.MAX_ENCODED_CHARS) {
        return { src, w: dims.w, h: dims.h, quality: q, attempts }
      }
    }
    const longest = Math.max(dims.w, dims.h)
    if (longest <= cfg.MIN_DIMENSION_PX) return null
    const next = Math.max(cfg.MIN_DIMENSION_PX, Math.floor(longest * cfg.DIMENSION_STEP))
    dims = scaleToFit(dims.w, dims.h, next)
  }
}

/** Stroke gửi lên server. color/width/opacity giữ giá trị hợp lệ vì bảng
 *  strokes đặt NOT NULL cho các cột đó. */
export function buildImageStroke(rect, src) {
  return { tool: 'image', color: '#000000', width: 0, opacity: 1, points: rectToPoints(rect), src }
}
