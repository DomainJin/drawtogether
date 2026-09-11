/** Tô loang ở không gian màn hình — kiểm trên đệm RGBA nhân tạo.
 *
 *  Đúng thứ người dùng báo: "không còn bậc thang nhưng tô chưa đủ" — giữa vùng
 *  tô và nét bút còn một viền trắng. Viền đó là khoảng cách tính bằng PIXEL,
 *  nên test phải đọc pixel: kiểm rằng ô ngay sát nét đã được tô, và kiểm rằng
 *  mực không tràn qua nét.
 */
import { floodFillPixels, ALPHA_SOLID } from '../src/waterfall/pixelFill.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const buf = (w, h) => new Uint8ClampedArray(w * h * 4)   // toàn 0 = trong suốt
const put = (b, w, x, y, a) => {
  const p = (y * w + x) * 4
  b[p] = 26; b[p + 1] = 26; b[p + 2] = 26; b[p + 3] = a
}
const alpha = (b, w, x, y) => b[(y * w + x) * 4 + 3]
const countAlpha = (b, a) => {
  let n = 0
  for (let i = 3; i < b.length; i += 4) if (b[i] === a) n++
  return n
}

// ── Khung kín: tô đúng phần bên trong, không tràn ra ngoài ─────────────────
const W = 20, H = 20
const ring = buf(W, H)
for (let x = 2; x <= 17; x++) { put(ring, W, x, 2, 255); put(ring, W, x, 17, 255) }
for (let y = 2; y <= 17; y++) { put(ring, W, 2, y, 255); put(ring, W, 17, y, 255) }

const inside = floodFillPixels(ring, W, H, 10, 10, { solid: true })
t('tô đúng 196 pixel bên trong khung', inside === 196, `= ${inside}`)
t('mực không tràn ra ngoài khung', alpha(ring, W, 0, 0) === 0)
t('viền khung giữ nguyên', alpha(ring, W, 2, 10) === 255)

// Đây là điều người dùng phàn nàn: pixel SÁT nét phải được tô, không chừa khe.
let gaps = 0
for (let y = 3; y <= 16; y++) {
  if (alpha(ring, W, 3, y) !== 255) gaps++       // sát mép trái
  if (alpha(ring, W, 16, y) !== 255) gaps++      // sát mép phải
}
for (let x = 3; x <= 16; x++) {
  if (alpha(ring, W, x, 3) !== 255) gaps++       // sát mép trên
  if (alpha(ring, W, x, 16) !== 255) gaps++      // sát mép dưới
}
t('không còn khe hở nào giữa vùng tô và nét', gaps === 0, `${gaps} pixel hụt`)

// ── Nuốt viền khử răng cưa: không để lại sợi xám giữa hai mảng đen ─────────
const FW = 20, FH = 10
const fringe = buf(FW, FH)
for (let y = 0; y < FH; y++) {
  put(fringe, FW, 9, y, 180)     // rìa khử răng cưa của nét
  put(fringe, FW, 10, y, 255)    // lõi đặc của nét
}
const left = floodFillPixels(fringe, FW, FH, 0, 0, { solid: true })
t('tô hết phần trống bên trái rồi nuốt luôn rìa',
  left === 9 * FH + FH, `= ${left}, chờ ${9 * FH + FH}`)
t('rìa alpha 180 được nâng thành đặc, hết sợi xám',
  alpha(fringe, FW, 9, 5) === 255, `= ${alpha(fringe, FW, 9, 5)}`)
t('lõi nét vẫn nguyên', alpha(fringe, FW, 10, 5) === 255)
t('không tràn sang phía bên kia nét', alpha(fringe, FW, 11, 5) === 0)

// Nuốt rìa chỉ nới ĐÚNG một pixel, không lan dây chuyền qua lõi.
const thin = buf(6, 3)
for (let y = 0; y < 3; y++) {
  put(thin, 6, 2, y, 200)
  put(thin, 6, 3, y, 200)
  put(thin, 6, 4, y, 200)
}
floodFillPixels(thin, 6, 3, 0, 1, { solid: true })
t('nuốt rìa dừng sau một pixel, không xuyên qua nét',
  alpha(thin, 6, 3, 1) === 200 && alpha(thin, 6, 4, 1) === 200,
  `cột 3 = ${alpha(thin, 6, 3, 1)}, cột 4 = ${alpha(thin, 6, 4, 1)}`)

// ── Xoá một mảng đặc ──────────────────────────────────────────────────────
const blob = buf(10, 10)
for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) put(blob, 10, x, y, 255)
const erased = floodFillPixels(blob, 10, 10, 5, 5, { solid: false })
t('xoá đúng 36 pixel của mảng', erased === 36, `= ${erased}`)
t('mảng đã biến mất', countAlpha(blob, 255) === 0)
t('phần trống xung quanh không đổi', alpha(blob, 10, 0, 0) === 0)

// ── Biên & đầu vào xấu ────────────────────────────────────────────────────
const solidAll = buf(4, 4)
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) put(solidAll, 4, x, y, 255)
t('chạm đúng vào nét khi đang đổ đầy → báo không làm được',
  floodFillPixels(solidAll, 4, 4, 1, 1, { solid: true }) === -1)
t('chạm vào chỗ trống khi đang xoá → báo không làm được',
  floodFillPixels(buf(4, 4), 4, 4, 1, 1, { solid: false }) === -1)
t('kích thước 0 → báo không làm được',
  floodFillPixels(buf(1, 1), 0, 0, 0, 0, { solid: true }) === -1)
t('đệm ngắn hơn khai báo → báo không làm được',
  floodFillPixels(buf(2, 2), 10, 10, 0, 0, { solid: true }) === -1)

const clampBuf = buf(5, 5)
t('mầm ngoài khung được kéo về trong khung',
  floodFillPixels(clampBuf, 5, 5, -99, -99, { solid: true }) === 25)

// ── Ngưỡng đặc khớp quy ước của lưới ──────────────────────────────────────
const halfCover = buf(3, 1)
put(halfCover, 3, 1, 0, ALPHA_SOLID)
t('pixel phủ đúng nửa được coi là nét, chặn được mực',
  floodFillPixels(halfCover, 3, 1, 0, 0, { solid: true }) === 2,
  'tô ô 0 rồi nuốt rìa, không qua được ô 1')

// -- Tran chong tran ------------------------------------------------------
const capped = buf(20, 20)
t('vuot tran thi bo do va bao khong lam duoc',
  floodFillPixels(capped, 20, 20, 0, 0, { solid: true, maxPixels: 50 }) === -1)
t('bo do thi KHONG dung vao dem pixel', countAlpha(capped, 255) === 0)

const underCap = buf(20, 20)
t('duoi tran thi to binh thuong',
  floodFillPixels(underCap, 20, 20, 0, 0, { solid: true, maxPixels: 10000 }) === 400)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
