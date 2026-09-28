/** Nét chữ ký dạng mảng phẳng [x, y, t, x, y, t, ...] — SPEC §3.1.
 *  x theo rộng bảng ký, y theo cao, cả hai ∈ [0,1]; t = ms từ điểm đầu tiên. */

const perpDist = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  return Math.abs(dy * px - dx * py + bx * ay - by * ax) / Math.sqrt(len2)
}

/** Ramer–Douglas–Peucker trên (x·aspect, y) — đo trong đơn vị cao bảng ký, nên
 *  epsilon không phụ thuộc chiều ngang. Giữ nguyên t của điểm được giữ.
 *  Lặp bằng stack (không đệ quy): nét 6000 điểm không tràn stack. */
export function simplifyStroke(flat, epsilon, aspect = 1) {
  const n = flat.length / 3
  if (n <= 2 || epsilon <= 0) return flat.slice()
  const keep = new Uint8Array(n)
  keep[0] = keep[n - 1] = 1
  const stack = [[0, n - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const ax = flat[a * 3] * aspect, ay = flat[a * 3 + 1]
    const bx = flat[b * 3] * aspect, by = flat[b * 3 + 1]
    let maxD = -1, idx = -1
    for (let i = a + 1; i < b; i++) {
      const d = perpDist(flat[i * 3] * aspect, flat[i * 3 + 1], ax, ay, bx, by)
      if (d > maxD) { maxD = d; idx = i }
    }
    if (maxD > epsilon) {
      keep[idx] = 1
      stack.push([a, idx], [idx, b])
    }
  }
  const out = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(flat[i * 3], flat[i * 3 + 1], flat[i * 3 + 2])
  return out
}

const round4 = (v) => Math.round(v * 10000) / 10000

/** Làm tròn như server (4 chữ số, t nguyên) — gửi đúng thứ server sẽ lưu. */
export function roundStroke(flat) {
  const out = new Array(flat.length)
  for (let i = 0; i < flat.length; i += 3) {
    out[i] = round4(flat[i])
    out[i + 1] = round4(flat[i + 1])
    out[i + 2] = Math.round(flat[i + 2])
  }
  return out
}

export function totalPoints(strokes) {
  let n = 0
  for (const s of strokes) n += s.length / 3
  return n
}

/** Hộp bao theo pad units (x·aspect, y). null nếu không có điểm. */
export function strokesBounds(strokes, aspect) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) {
    for (let i = 0; i < s.length; i += 3) {
      const x = s[i] * aspect, y = s[i + 1]
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY }
}

/** Thời điểm điểm cuối cùng (ms) — độ dài "bản thu" của hiệu ứng viết. */
export function signatureDuration(strokes) {
  let end = 0
  for (const s of strokes) if (s.length) end = Math.max(end, s[s.length - 1])
  return end
}

/** Chuẩn bị gửi: đơn giản hoá + làm tròn; bỏ nét rỗng. */
export function encodeStrokes(strokes, epsilon, aspect) {
  return strokes
    .filter((s) => s.length >= 3)
    .map((s) => roundStroke(simplifyStroke(s, epsilon, aspect)))
}
