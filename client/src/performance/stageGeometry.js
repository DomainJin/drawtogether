/** Hình học khung xuất / vùng LED / nền. Pure — test được không cần DOM. */

/** Co khung xuất frameW×frameH vừa khung chứa (letterbox, căn giữa). */
export function fitFrame(containerW, containerH, frameW, frameH) {
  if (containerW <= 0 || containerH <= 0 || frameW <= 0 || frameH <= 0) {
    return { scale: 0, x: 0, y: 0 }
  }
  const scale = Math.min(containerW / frameW, containerH / frameH)
  return {
    scale,
    x: (containerW - frameW * scale) / 2,
    y: (containerH - frameH * scale) / 2,
  }
}

/** Đặt ảnh/video src vào đích theo object-fit — dùng khi chụp màn show (canvas
 *  không có object-fit, phải tự tính giống hệt CSS để ảnh chụp khớp màn hình). */
export function fitRect(srcW, srcH, dstW, dstH, fit) {
  if (fit === 'stretch' || srcW <= 0 || srcH <= 0) return { x: 0, y: 0, w: dstW, h: dstH }
  const s = fit === 'contain'
    ? Math.min(dstW / srcW, dstH / srcH)
    : Math.max(dstW / srcW, dstH / srcH)
  const w = srcW * s, h = srcH * s
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h }
}

/** Vị trí QR trên vùng LED. Cạnh + lề theo cao vùng, caption nằm dưới QR. */
export function qrPlacement(regionW, regionH, qr) {
  const size = Math.round(qr.size * regionH)
  const margin = Math.round(regionH * 0.03)
  const captionH = qr.caption ? Math.round(size * 0.16) : 0
  const boxH = size + captionH
  const left = qr.corner === 'tl' || qr.corner === 'bl'
  const top = qr.corner === 'tl' || qr.corner === 'tr'
  return {
    x: left ? margin : regionW - margin - size,
    y: top ? margin : regionH - margin - boxH,
    size,
    captionH,
  }
}

/** Độ phân giải thật của canvas: đủ nét cho pixel màn hình đang hiển thị, không
 *  vượt độ phân giải vùng LED (preview nhỏ trong setup không cần canvas 4K). */
export function canvasPixelScale(displayScale, devicePixelRatio) {
  const s = displayScale * (devicePixelRatio || 1)
  return Math.max(0.1, Math.min(1, s))
}
