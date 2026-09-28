/** Link QR và khoá admin. Pure phần tính URL (test được), phần localStorage bọc
 *  try/catch — Safari ẩn danh ném lỗi khi ghi. */
import { LS_KEYS, PERF_ROUTES } from './config.js'

/** Gốc URL cho link ký. Ưu tiên publicBaseUrl (kỹ thuật chọn IP LAN), không có
 *  thì origin trang đang mở. */
export function signUrl(eventId, publicBaseUrl, origin) {
  const base = (publicBaseUrl || origin || '').replace(/\/+$/, '')
  return `${base}${PERF_ROUTES.sign(eventId)}`
}

/** localhost/127.x trong QR = điện thoại khán giả gọi vào chính nó → hỏng. */
export function isLoopbackUrl(url) {
  try {
    const h = new URL(url).hostname
    return h === 'localhost' || h === '::1' || h === '[::1]' || /^127\./.test(h)
  } catch {
    return false
  }
}

/** Origin client ứng với một IP LAN, giữ nguyên protocol + port trang hiện tại. */
export function originForHost(host, location) {
  const port = location?.port ? `:${location.port}` : ''
  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:'
  return `${protocol}//${host}${port}`
}

export function loadAdminKey(eventId) {
  try { return localStorage.getItem(LS_KEYS.adminKey(eventId)) || '' } catch { return '' }
}

export function saveAdminKey(eventId, key) {
  try { localStorage.setItem(LS_KEYS.adminKey(eventId), key) } catch { /* ẩn danh */ }
}

export function lsGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}

export function lsSet(key, value) {
  try { localStorage.setItem(key, value) } catch { /* ẩn danh */ }
}
