/** Kiểm tra chữ ký khán giả gửi lên. Khán giả là người lạ quét QR — mọi thứ
 *  từ họ đều phải kiểm và kẹp trước khi vào DB và phát cho màn LED.
 *  Format: docs/performance/SPEC.md §3.1. */

export const SIGNATURE_LIMITS = {
  MAX_STROKES: 120,
  MAX_POINTS: 6000,
  MAX_DURATION_MS: 600_000,
  MAX_NAME_CHARS: 40,
  /** Toạ độ lệch ra ngoài bảng ký một chút (ngón tay trượt quá mép) thì kẹp
   *  lại; lệch nhiều hơn là dữ liệu rác. */
  EDGE_TOLERANCE: 0.05,
  MIN_ASPECT: 0.25,
  MAX_ASPECT: 4,
  SUBMIT_COOLDOWN_MS: 1500,
  MAX_PER_EVENT: 5000,
}

const L = SIGNATURE_LIMITS
const CID = /^[A-Za-z0-9_-]{8,32}$/
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g

const round4 = (v) => Math.round(v * 10000) / 10000
const clamp01 = (v) => Math.min(1, Math.max(0, v))

/** Mảng phẳng [x,y,t,...] đã kẹp/làm tròn, hoặc chuỗi lỗi. */
function cleanStroke(s) {
  if (!Array.isArray(s) || s.length < 3 || s.length % 3 !== 0) return 'bad_stroke'
  const out = new Array(s.length)
  for (let i = 0; i < s.length; i += 3) {
    const x = s[i], y = s[i + 1], t = s[i + 2]
    if (![x, y, t].every((v) => typeof v === 'number' && Number.isFinite(v))) return 'bad_point'
    if (x < -L.EDGE_TOLERANCE || x > 1 + L.EDGE_TOLERANCE) return 'bad_point'
    if (y < -L.EDGE_TOLERANCE || y > 1 + L.EDGE_TOLERANCE) return 'bad_point'
    if (t < 0 || t > L.MAX_DURATION_MS) return 'bad_time'
    out[i] = round4(clamp01(x))
    out[i + 1] = round4(clamp01(y))
    out[i + 2] = Math.round(t)
  }
  return out
}

/** @returns {{ok:true, value:object} | {ok:false, error:string}} */
export function validateSignature(input) {
  if (!input || typeof input !== 'object') return { ok: false, error: 'bad_payload' }
  const { cid, name, color, aspect, strokes } = input

  if (typeof cid !== 'string' || !CID.test(cid)) return { ok: false, error: 'bad_cid' }
  if (typeof aspect !== 'number' || !Number.isFinite(aspect)
    || aspect < L.MIN_ASPECT || aspect > L.MAX_ASPECT) return { ok: false, error: 'bad_aspect' }
  if (!Array.isArray(strokes) || strokes.length === 0) return { ok: false, error: 'empty' }
  if (strokes.length > L.MAX_STROKES) return { ok: false, error: 'too_many_strokes' }

  let points = 0
  const clean = []
  for (const s of strokes) {
    const r = cleanStroke(s)
    if (typeof r === 'string') return { ok: false, error: r }
    points += r.length / 3
    if (points > L.MAX_POINTS) return { ok: false, error: 'too_many_points' }
    clean.push(r)
  }

  const cleanName = typeof name === 'string'
    ? name.replace(CONTROL_CHARS, '').trim().slice(0, L.MAX_NAME_CHARS)
    : ''

  return {
    ok: true,
    value: {
      cid,
      name: cleanName,
      color: typeof color === 'string' && HEX_COLOR.test(color) ? color.toLowerCase() : null,
      aspect: Math.round(aspect * 1000) / 1000,
      strokes: clean,
    },
  }
}
