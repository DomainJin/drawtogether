/** Địa chỉ server mà client gọi tới.
 *
 *  Đặt VITE_SERVER_URL lúc build thì dùng đúng giá trị đó (deploy Railway,
 *  server khác domain). Không đặt thì suy từ chính trang đang mở: iPad vào
 *  http://192.168.1.150:5173 thì server là http://192.168.1.150:3001. Nhờ vậy
 *  bản đóng gói mang sang laptop khác, IP khác, KHÔNG phải build lại — bản cũ
 *  mặc định localhost nên iPad luôn gọi nhầm vào chính nó. */
import { WHITEBOARD_CONFIG } from './config.js'

export function resolveServerUrl(envUrl, location, port = WHITEBOARD_CONFIG.SERVER_PORT) {
  if (envUrl) return envUrl.replace(/\/+$/, '')
  if (!location?.hostname) return `http://localhost:${port}`
  const protocol = location.protocol === 'https:' ? 'https:' : 'http:'
  return `${protocol}//${location.hostname}:${port}`
}

export const SERVER_URL = resolveServerUrl(
  import.meta.env?.VITE_SERVER_URL,
  typeof window !== 'undefined' ? window.location : null,
)
