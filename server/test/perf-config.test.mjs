// Config Performance: sanitize kẹp/lọc từng lá, giữ base khi input sai, ràng buộc vùng LED.
import { CONFIG_SCHEMA, defaultConfig, sanitizeConfig, MIN_REGION_PX } from '../src/perf/configSchema.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}

const d = defaultConfig()
t('default: khung 1920x1080, vùng = cả khung', d.output.frameW === 1920 && d.output.frameH === 1080 && d.output.w === 1920 && d.output.h === 1080)
t('schema serialize được (gửi cho admin qua socket)', JSON.stringify(JSON.parse(JSON.stringify(CONFIG_SCHEMA))) === JSON.stringify(CONFIG_SCHEMA))
t('sanitize(undefined) = defaults', JSON.stringify(sanitizeConfig(undefined)) === JSON.stringify(d))

let c = sanitizeConfig({ ink: { width: 99, glow: -1, mode: 'hacker', color: '#ABCDEF' } })
t('num vượt max → kẹp max', c.ink.width === CONFIG_SCHEMA.ink.width.max, c.ink.width)
t('num dưới min → kẹp min', c.ink.glow === 0, c.ink.glow)
t('enum lạ → giữ base', c.ink.mode === d.ink.mode)
t('màu hex → chữ thường', c.ink.color === '#abcdef')

c = sanitizeConfig({ ink: { width: NaN, color: 'red' } })
t('NaN → base', c.ink.width === d.ink.width)
t('màu không phải #rrggbb → base', c.ink.color === d.ink.color)

c = sanitizeConfig({ layout: { maxVisible: 12.6 } })
t('int làm tròn', c.layout.maxVisible === 13)
c = sanitizeConfig({ layout: { maxVisible: '25' } })
t('chuỗi số (input HTML) → số', c.layout.maxVisible === 25)

const base = sanitizeConfig({ name: { font: 'Pacifico' } })
c = sanitizeConfig({ ink: { color: '#000000' } }, base)
t('patch một phần giữ phần còn lại từ base', c.name.font === 'Pacifico' && c.ink.color === '#000000')

c = sanitizeConfig({ hacked: 1, ink: { evil: '<script>' } })
t('key lạ bị bỏ', !('hacked' in c) && !('evil' in c.ink))

c = sanitizeConfig({ showBg: { url: 'javascript:alert(1)' } })
t('url javascript: bị từ chối', c.showBg.url === '')
c = sanitizeConfig({ showBg: { url: 'data:image/png;base64,xx' } })
t('url data: bị từ chối', c.showBg.url === '')
c = sanitizeConfig({ showBg: { url: '/api/perf/media/abc123/Xy_z.mp4' } })
t('url media nội bộ hợp lệ', c.showBg.url === '/api/perf/media/abc123/Xy_z.mp4')
c = sanitizeConfig({ showBg: { url: '/api/perf/media/../../etc/passwd' } })
t('url media có .. bị từ chối', c.showBg.url === '')
c = sanitizeConfig({ showBg: { url: 'https://cdn.example.com/bg.jpg' } })
t('url https hợp lệ', c.showBg.url === 'https://cdn.example.com/bg.jpg')
c = sanitizeConfig({ showBg: { url: '' } }, sanitizeConfig({ showBg: { url: 'https://a.b/c.jpg' } }))
t('url "" = xoá nền (không rơi về base)', c.showBg.url === '')

c = sanitizeConfig({ sign: { title: 'A\u0000B\nC' + 'x'.repeat(200) } })
t('str: bỏ ký tự điều khiển + cắt maxLen', c.sign.title.startsWith('ABC') && c.sign.title.length === CONFIG_SCHEMA.sign.title.maxLen)

c = sanitizeConfig({ sign: { signerColors: ['#FFFFFF', 'bad', '#000000', ...Array(20).fill('#111111')] } })
t('colors: lọc sai + cắt maxItems', c.sign.signerColors[0] === '#ffffff' && c.sign.signerColors[1] === '#000000' && c.sign.signerColors.length === CONFIG_SCHEMA.sign.signerColors.maxItems)
c = sanitizeConfig({ sign: { signerColors: ['bad'] } })
t('colors rỗng sau lọc → base', c.sign.signerColors.length === d.sign.signerColors.length)

// Vùng LED phải nằm trong khung
c = sanitizeConfig({ output: { frameW: 1280, lock169: true, x: 100, y: 50, w: 5000, h: 5000 } })
t('lock169: frameH = frameW*9/16', c.output.frameH === 720, c.output)
t('w kẹp theo frameW - x', c.output.w === 1180, c.output.w)
t('h kẹp theo frameH - y', c.output.h === 670, c.output.h)
c = sanitizeConfig({ output: { frameW: 1920, lock169: false, frameH: 600, x: 5000, y: 5000 } })
t('x,y kẹp để vùng còn ≥ MIN_REGION_PX', c.output.x === 1920 - MIN_REGION_PX && c.output.y === 600 - MIN_REGION_PX && c.output.w === MIN_REGION_PX, c.output)
c = sanitizeConfig({ output: { frameW: 1921, lock169: true } })
t('lock169 với frameW lẻ → làm tròn', c.output.frameH === 1081)

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-config tests passed')
