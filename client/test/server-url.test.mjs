// Client tự suy địa chỉ server từ trang đang mở — bản đóng gói chạy được ở mọi IP.
import { resolveServerUrl } from '../src/whiteboard/serverUrl.js'

let fails = 0
const t = (name, got, want) => {
  const ok = got === want
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${got}`)
  if (!ok) fails++
}
const loc = (protocol, hostname) => ({ protocol, hostname })

t('iPad vào IP LAN → server cùng IP, port 3001', resolveServerUrl('', loc('http:', '192.168.1.150')), 'http://192.168.1.150:3001')
t('mở trên chính laptop', resolveServerUrl(undefined, loc('http:', 'localhost')), 'http://localhost:3001')
t('trang https → server https', resolveServerUrl('', loc('https:', 'wb.example.com')), 'https://wb.example.com:3001')
t('VITE_SERVER_URL đặt thì luôn thắng', resolveServerUrl('https://x.up.railway.app', loc('http:', '10.0.0.5')), 'https://x.up.railway.app')
t('bỏ dấu / cuối của env', resolveServerUrl('http://a:3001//', null), 'http://a:3001')
t('không có window (SSR/test) → localhost', resolveServerUrl('', null), 'http://localhost:3001')
t('port tuỳ chỉnh', resolveServerUrl('', loc('http:', '10.0.0.5'), 4000), 'http://10.0.0.5:4000')

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All server-url tests passed')
