// Phục vụ client đã build (thư mục client/) cho iPad/trình duyệt trong LAN.
// Không phụ thuộc gói npm nào — chỉ dùng node:http, để bản đóng gói chạy được
// bằng mỗi node.exe. SPA: đường dẫn không phải file (vd /abc123 là mã phòng)
// trả về index.html để React Router xử lý.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('./client/', import.meta.url)))
const PORT = Number(process.env.WB_CLIENT_PORT) || 5173
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

/** File ứng với URL, hoặc index.html (SPA). null nếu URL cố thoát khỏi ROOT. */
async function fileFor(urlPath) {
  let rel
  try {
    rel = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^[/\\]+/, '')
  } catch {
    return null // %-encoding hỏng
  }
  const full = join(ROOT, rel)
  if (full !== ROOT && !full.startsWith(ROOT + sep)) return null
  try {
    if ((await stat(full)).isFile()) return full
  } catch { /* không có file → SPA fallback */ }
  return join(ROOT, 'index.html')
}

createServer(async (req, res) => {
  try {
    const file = await fileFor(req.url || '/')
    if (!file) { res.writeHead(403).end(); return }
    const body = await readFile(file)
    const isAsset = file.includes(`${sep}assets${sep}`)
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      // Asset có hash trong tên → cache lâu; index.html luôn lấy mới.
      'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
    res.end(body)
  } catch (err) {
    res.writeHead(500).end(String(err?.message || err))
  }
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Client: http://0.0.0.0:${PORT}  (thu muc ${ROOT})`)
})
