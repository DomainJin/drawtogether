/** Config của một sự kiện Performance — nguồn sự thật duy nhất.
 *
 *  Schema là dữ liệu thuần (serialize được): server gửi nó cho trang setup lúc
 *  admin join, UI dựng slider/select từ min/max/options ở đây. Nhờ vậy giới hạn
 *  chỉ khai báo MỘT lần — client không tự gõ lại rồi lệch với server.
 *
 *  Mọi kích thước hiển thị là tỉ lệ (theo cao vùng LED / cao bảng ký), không phải
 *  px: đổi độ phân giải LED không phải chỉnh lại style. Xem docs/performance/SPEC.md. */

const num = (def, min, max, step = 0.01) => ({ t: 'num', def, min, max, step })
const int = (def, min, max) => ({ t: 'int', def, min, max })
const oneOf = (def, options) => ({ t: 'enum', def, options })
const color = (def) => ({ t: 'color', def })
const text = (def, maxLen) => ({ t: 'str', def, maxLen })
const bool = (def) => ({ t: 'bool', def })
const url = () => ({ t: 'url', def: '' })
const colors = (def, maxItems) => ({ t: 'colors', def, maxItems })

/** Cạnh nhỏ nhất của vùng LED (px khung xuất) — nhỏ hơn thì không vẽ nổi gì. */
export const MIN_REGION_PX = 16
export const MAX_FRAME_PX = 7680

const background = (def) => ({
  type: oneOf(def.type, ['color', 'image', 'video']),
  color: color(def.color),
  url: url(),
  fit: oneOf('cover', ['cover', 'contain', 'stretch']),
  dim: num(def.dim, 0, 0.9),
})

export const CONFIG_SCHEMA = {
  output: {
    frameW: int(1920, 320, MAX_FRAME_PX),
    frameH: int(1080, 180, MAX_FRAME_PX),
    lock169: bool(true),
    x: int(0, 0, MAX_FRAME_PX),
    y: int(0, 0, MAX_FRAME_PX),
    w: int(1920, MIN_REGION_PX, MAX_FRAME_PX),
    h: int(1080, MIN_REGION_PX, MAX_FRAME_PX),
  },
  showBg: background({ type: 'color', color: '#05060f', dim: 0 }),
  signBg: background({ type: 'color', color: '#101828', dim: 0.35 }),
  ink: {
    mode: oneOf('solid', ['solid', 'gradient', 'rainbow', 'signer']),
    color: color('#ffffff'),
    color2: color('#ffd166'),
    /** Độ dày nét theo cao bảng ký. */
    width: num(0.022, 0.005, 0.08, 0.001),
    /** 0 = tắt phát sáng. */
    glow: num(0.35, 0, 1),
    glowColor: color('#ffd166'),
  },
  name: {
    show: bool(true),
    font: oneOf('Dancing Script', [
      'Dancing Script', 'Great Vibes', 'Pacifico', 'Lobster', 'Charm',
      'Be Vietnam Pro', 'Montserrat', 'Arial', 'Georgia', 'Times New Roman', 'Impact',
    ]),
    style: oneOf('neon', ['plain', 'gradient', 'outline', 'shadow', 'neon']),
    color: color('#ffffff'),
    color2: color('#ff9f1c'),
    /** Cao dòng tên theo cao bảng ký. */
    size: num(0.2, 0.08, 0.5),
  },
  layout: {
    mode: oneOf('float', ['grid', 'float']),
    maxVisible: int(40, 1, 500),
    /** Khoảng cách giữa các ô lưới / lề vùng — theo cao vùng LED. */
    gap: num(0.02, 0, 0.15, 0.005),
    padding: num(0.04, 0, 0.3, 0.005),
    /** Cao một chữ ký ở chế độ trôi — theo cao vùng LED. */
    floatSize: num(0.2, 0.05, 0.6),
    /** Tốc độ trôi — cao vùng LED / giây. */
    floatSpeed: num(0.05, 0, 0.5, 0.005),
  },
  effect: {
    entrance: oneOf('draw', ['draw', 'fade', 'zoom', 'fly']),
    entranceMs: int(1800, 200, 8000),
    spotlight: bool(true),
    spotlightMs: int(4000, 1000, 20000),
    /** Cao chữ ký lúc spotlight — theo cao vùng LED. */
    spotlightScale: num(0.5, 0.2, 0.95),
  },
  qr: {
    show: bool(true),
    corner: oneOf('br', ['tl', 'tr', 'bl', 'br']),
    /** Cạnh QR theo cao vùng LED. */
    size: num(0.16, 0.06, 0.5),
    caption: text('Quét để ký tên', 60),
  },
  sign: {
    title: text('Ký tên lưu niệm', 80),
    subtitle: text('Chữ ký của bạn sẽ xuất hiện trên màn hình sân khấu', 160),
    nameField: oneOf('optional', ['off', 'optional', 'required']),
    namePlaceholder: text('Tên của bạn', 40),
    submitText: text('Gửi chữ ký', 30),
    thanksText: text('Cảm ơn bạn! Hãy nhìn lên màn hình ✨', 120),
    allowAgain: bool(true),
    padColor: color('#ffffff'),
    padOpacity: num(0.08, 0, 1),
    signerColors: colors(['#ffffff', '#ffd166', '#ef476f', '#06d6a0', '#4cc9f0', '#b388ff'], 8),
  },
  moderation: {
    requireApproval: bool(false),
  },
  publicBaseUrl: url(),
}

const isLeaf = (node) => node && typeof node === 'object' && typeof node.t === 'string'
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
/** Chỉ nhận file đã upload lên chính server, hoặc http(s) tuyệt đối. Chặn
 *  `javascript:`/`data:` — url này được gắn vào <img>/<video> trên mọi máy. */
const SAFE_URL = /^(\/api\/perf\/media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+|https?:\/\/[^\s"'<>]+)$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

/** Giá trị hợp lệ của một lá, hoặc undefined nếu `v` không dùng được. */
function sanitizeLeaf(desc, v) {
  switch (desc.t) {
    case 'num':
    case 'int': {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v
      if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
      const clamped = Math.min(desc.max, Math.max(desc.min, n))
      return desc.t === 'int' ? Math.round(clamped) : clamped
    }
    case 'enum':
      return desc.options.includes(v) ? v : undefined
    case 'color':
      return typeof v === 'string' && HEX_COLOR.test(v) ? v.toLowerCase() : undefined
    case 'str':
      return typeof v === 'string' ? v.replace(CONTROL_CHARS, '').slice(0, desc.maxLen) : undefined
    case 'bool':
      return typeof v === 'boolean' ? v : undefined
    case 'url': {
      if (typeof v !== 'string') return undefined
      const s = v.trim()
      if (s === '') return ''
      return s.length <= 500 && SAFE_URL.test(s) ? s : undefined
    }
    case 'colors': {
      if (!Array.isArray(v)) return undefined
      const list = v.filter((c) => typeof c === 'string' && HEX_COLOR.test(c)).map((c) => c.toLowerCase())
      return list.length ? list.slice(0, desc.maxItems) : undefined
    }
    default:
      return undefined
  }
}

function defaultsOf(schema) {
  const out = {}
  for (const [k, node] of Object.entries(schema)) {
    out[k] = isLeaf(node) ? structuredClone(node.def) : defaultsOf(node)
  }
  return out
}

function walk(schema, input, base) {
  const out = {}
  const src = input && typeof input === 'object' ? input : {}
  for (const [k, node] of Object.entries(schema)) {
    if (isLeaf(node)) {
      const v = sanitizeLeaf(node, src[k])
      out[k] = v !== undefined ? v : structuredClone(base[k])
    } else {
      out[k] = walk(node, src[k], base[k])
    }
  }
  return out
}

/** Ràng buộc giữa các lá — không diễn tả được bằng min/max từng lá. */
function fixOutput(o) {
  if (o.lock169) o.frameH = Math.round((o.frameW * 9) / 16)
  o.frameH = Math.max(CONFIG_SCHEMA.output.frameH.min, Math.min(MAX_FRAME_PX, o.frameH))
  o.x = Math.min(o.x, o.frameW - MIN_REGION_PX)
  o.y = Math.min(o.y, o.frameH - MIN_REGION_PX)
  o.w = Math.max(MIN_REGION_PX, Math.min(o.w, o.frameW - o.x))
  o.h = Math.max(MIN_REGION_PX, Math.min(o.h, o.frameH - o.y))
  return o
}

export function defaultConfig() {
  const d = defaultsOf(CONFIG_SCHEMA)
  fixOutput(d.output)
  return d
}

/** Lá hợp lệ lấy từ `input`, lá sai/thiếu lấy từ `base` (config hiện tại). Key
 *  lạ bị bỏ. Config cũ trong DB đi qua đây lúc đọc → field mới tự có default.
 *  `base` cũng được sanitize — không tin nó chỉ vì nó từ DB. */
export function sanitizeConfig(input, base) {
  const safeBase = base ? walk(CONFIG_SCHEMA, base, defaultConfig()) : defaultConfig()
  const out = walk(CONFIG_SCHEMA, input, safeBase)
  fixOutput(out.output)
  return out
}
