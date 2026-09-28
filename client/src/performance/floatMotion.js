/** Chuyển động trôi của chế độ "float". Pure + tất định: vận tốc/vị trí đầu
 *  sinh từ id chữ ký, nên màn show mở lại vẫn ra cùng kiểu chuyển động và test
 *  lặp lại được. */

/** Băm chuỗi → uint32 (FNV-1a). */
export function hashString(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** PRNG mulberry32 — đủ tốt cho hiệu ứng, 4 dòng. */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Vị trí (góc trên-trái, px vùng) + hướng + hệ số tốc độ + pha nhấp nhô. */
export function createFloater(id, W, H, w, h) {
  const rnd = mulberry32(hashString(id))
  const angle = rnd() * Math.PI * 2
  return {
    x: rnd() * Math.max(0, W - w),
    y: rnd() * Math.max(0, H - h),
    ux: Math.cos(angle),
    uy: Math.sin(angle),
    speed: 0.6 + rnd() * 0.8,
    phase: rnd() * Math.PI * 2,
  }
}

/** Bước một khung: đi theo hướng, dội mép. Vật to hơn vùng thì đứng giữa theo
 *  chiều đó. Mutates `f` (gọi mỗi frame — không cấp phát). */
export function stepFloater(f, dt, speedPx, W, H, w, h) {
  const maxX = W - w, maxY = H - h
  if (maxX <= 0) f.x = maxX / 2
  else {
    f.x += f.ux * f.speed * speedPx * dt
    if (f.x < 0) { f.x = -f.x; f.ux = Math.abs(f.ux) }
    if (f.x > maxX) { f.x = 2 * maxX - f.x; f.ux = -Math.abs(f.ux) }
    f.x = Math.min(maxX, Math.max(0, f.x))
  }
  if (maxY <= 0) f.y = maxY / 2
  else {
    f.y += f.uy * f.speed * speedPx * dt
    if (f.y < 0) { f.y = -f.y; f.uy = Math.abs(f.uy) }
    if (f.y > maxY) { f.y = 2 * maxY - f.y; f.uy = -Math.abs(f.uy) }
    f.y = Math.min(maxY, Math.max(0, f.y))
  }
  return f
}
