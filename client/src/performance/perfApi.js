/** REST của Performance mode — SPEC §5. Mọi request có timeout. */
import { SERVER_URL } from '../whiteboard/serverUrl.js'
import { PERF_CONFIG as P } from './config.js'

const REQUEST_TIMEOUT_MS = 10_000

async function request(path, init = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(`${SERVER_URL}${path}`, { ...init, signal: ctrl.signal })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
    return body
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Server không phản hồi')
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** @returns {Promise<{event, adminKey}>} */
export function createPerfEvent(name) {
  return request('/api/perf/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function perfEventExists(id) {
  try {
    await request(`/api/perf/events/${encodeURIComponent(id)}`)
    return true
  } catch {
    return false
  }
}

export async function lanAddresses() {
  try {
    return (await request('/api/perf/lan')).addresses ?? []
  } catch {
    return []
  }
}

const UPLOAD_ERRORS = {
  unsupported_type: 'Định dạng không hỗ trợ (dùng PNG/JPG/WebP/GIF hoặc MP4/WebM/MOV)',
  too_large: 'File quá lớn',
  forbidden: 'Sai khoá quản trị',
}

/** Upload file nền. XHR thay vì fetch để có tiến độ (video vài trăm MB).
 *  @returns {Promise<{url, kind}>} */
export function uploadMedia(eventId, adminKey, file, onProgress) {
  if (file.size > P.MEDIA_MAX_BYTES) {
    return Promise.reject(new Error(`File quá lớn (tối đa ${Math.round(P.MEDIA_MAX_BYTES / 1048576)}MB)`))
  }
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${SERVER_URL}/api/perf/events/${encodeURIComponent(eventId)}/media`)
    xhr.timeout = P.MEDIA_UPLOAD_TIMEOUT_MS
    xhr.setRequestHeader('Content-Type', file.type)
    xhr.setRequestHeader('x-perf-key', adminKey)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => {
      let body = {}
      try { body = JSON.parse(xhr.responseText) } catch { /* giữ {} */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body)
      else reject(new Error(UPLOAD_ERRORS[body.error] || body.error || `HTTP ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi upload'))
    xhr.ontimeout = () => reject(new Error('Upload quá lâu, đã huỷ'))
    xhr.send(file)
  })
}

/** url trong config là đường dẫn tương đối tới server — client và server khác port. */
export function mediaUrl(url) {
  if (!url) return ''
  return url.startsWith('/') ? `${SERVER_URL}${url}` : url
}
