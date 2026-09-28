/** Fullscreen API qua cả hai tên: chuẩn và `webkit` (Safari trên iPad chỉ có
 *  bản webkit cho phần tử không phải video). Nhận `doc`/`el` từ ngoài để test
 *  được bằng object giả, không cần DOM thật.
 *
 *  iPhone không có Fullscreen API cho phần tử thường — các hàm trả false thay
 *  vì ném lỗi, caller vẫn ẩn được giao diện thừa (xem useFocusMode). */

export const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange']

/** iPhone/iPad. iPadOS 13+ tự xưng là "Macintosh" nên phải nhìn thêm màn cảm
 *  ứng đa điểm — Mac thật có maxTouchPoints = 0. */
export function isIOS(nav) {
  const ua = nav?.userAgent ?? ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && (nav?.maxTouchPoints ?? 0) > 1
}

/** Đang chạy như app từ Màn hình chính (không có thanh trình duyệt). */
export function isStandalone(win) {
  if (win?.navigator?.standalone === true) return true
  try {
    return !!win?.matchMedia?.('(display-mode: standalone)').matches
      || !!win?.matchMedia?.('(display-mode: fullscreen)').matches
  } catch {
    return false
  }
}

/** Có nên gọi Fullscreen API của trình duyệt không.
 *
 *  KHÔNG trên iOS: Safari iPad coi chạm liên tục trong chế độ toàn màn hình là
 *  dấu hiệu trang giả mạo, cứ vài lần bấm lại bật hộp "duy trì toàn màn hình?"
 *  — trang không tắt được hộp đó. Toàn màn hình thật trên iPad lấy từ "Thêm
 *  vào Màn hình chính" (standalone) thay vào. Đã standalone thì cũng khỏi gọi. */
export function shouldUseNativeFullscreen({ ios, standalone }) {
  return !ios && !standalone
}

/** iPhone/iPad đang mở bằng Safari: muốn toàn màn hình thật phải "Thêm vào
 *  Màn hình chính" — giao diện nhắc người dùng điều đó. */
export function needsHomeScreenForFullscreen({ ios, standalone }) {
  return ios && !standalone
}

/** HOME_SCREEN_STEPS dùng chung cho mọi chỗ nhắc, để lời hướng dẫn không lệch nhau. */
export const HOME_SCREEN_STEPS = 'Safari → nút Chia sẻ → "Thêm vào MH chính", rồi mở từ biểu tượng Màn nước'

export function fullscreenElement(doc) {
  return doc?.fullscreenElement ?? doc?.webkitFullscreenElement ?? null
}

export function canFullscreen(el) {
  return typeof (el?.requestFullscreen ?? el?.webkitRequestFullscreen) === 'function'
}

/** @returns {Promise<boolean>} đã vào toàn màn hình hay chưa */
export async function enterFullscreen(el) {
  const request = el?.requestFullscreen ?? el?.webkitRequestFullscreen
  if (typeof request !== 'function') return false
  try {
    await request.call(el)
    return true
  } catch {
    return false // người dùng/trình duyệt từ chối
  }
}

/** @returns {Promise<boolean>} đã thoát (hoặc vốn không ở toàn màn hình) */
export async function exitFullscreen(doc) {
  if (!fullscreenElement(doc)) return true
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen
  if (typeof exit !== 'function') return false
  try {
    await exit.call(doc)
    return true
  } catch {
    return false
  }
}
