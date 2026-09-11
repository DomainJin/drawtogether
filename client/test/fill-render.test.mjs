/** Đường vẽ thật của nét tô loang: drawStroke → tô ở độ phân giải màn hình,
 *  và quay về vẽ từ lưới khi không áp dụng được.
 *
 *  Dùng một ctx giả có đệm pixel thật, nên kiểm được kết quả bằng số thay vì
 *  tin rằng "chắc là nó gọi đúng hàm".
 */
import { drawStroke } from '../src/components/Waterfall/strokeRenderer.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

function fakeCtx(w, h, { withPixels = true } = {}) {
  const data = withPixels ? new Uint8ClampedArray(w * h * 4) : null
  const calls = { getImageData: 0, putImageData: 0, fill: 0, beginPath: 0 }
  const noop = () => {}
  return {
    canvas: { width: w, height: h },
    data, calls,
    globalCompositeOperation: 'source-over',
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineCap: '', lineJoin: '',
    save: noop, restore: noop, moveTo: noop, lineTo: noop, closePath: noop,
    rect: noop, arc: noop, stroke: noop, arcTo: noop, quadraticCurveTo: noop,
    beginPath() { calls.beginPath++ },
    fill() { calls.fill++ },
    getImageData() {
      calls.getImageData++
      if (!data) throw new Error('không được đọc pixel khi canvas quá lớn')
      return { data, width: w, height: h }
    },
    putImageData(img) { calls.putImageData++; data.set(img.data) },
  }
}

const put = (b, w, x, y, a) => {
  const p = (y * w + x) * 4
  b[p] = 26; b[p + 1] = 26; b[p + 2] = 26; b[p + 3] = a
}
const alpha = (b, w, x, y) => b[(y * w + x) * 4 + 3]

const fillStroke = (point) => ({
  tool: 'fill', point, value: 1,
  // runs/gridRows/gridCols là đường lui khi không tô pixel được; phải có mặt
  // để drawFill không bỏ qua nét.
  runs: [{ row: 0, c0: 0, c1: 3 }],
  gridRows: 4, gridCols: 4,
})

// ── Tô ở độ phân giải màn hình, ăn sát nét ────────────────────────────────
const W = 40, H = 40
const ctx = fakeCtx(W, H)
for (let x = 5; x <= 34; x++) { put(ctx.data, W, x, 5, 255); put(ctx.data, W, x, 34, 255) }
for (let y = 5; y <= 34; y++) { put(ctx.data, W, 5, y, 255); put(ctx.data, W, 34, y, 255) }

drawStroke(ctx, fillStroke({ x: 0.5, y: 0.5 }), W, H)

t('có đọc và ghi lại pixel', ctx.calls.getImageData === 1 && ctx.calls.putImageData === 1)
t('không dùng tới đường vẽ từ lưới', ctx.calls.fill === 0)
t('tâm hình được tô', alpha(ctx.data, W, 20, 20) === 255)
t('pixel sát nét cũng được tô, không chừa khe',
  alpha(ctx.data, W, 6, 20) === 255 && alpha(ctx.data, W, 33, 20) === 255)
t('ngoài khung vẫn trống', alpha(ctx.data, W, 0, 0) === 0)

// ── Điểm chạm chuẩn hoá quy ra đúng pixel ─────────────────────────────────
// Chia đôi khung bằng một vạch dọc, rồi chạm vào nửa PHẢI: chỉ nửa phải được tô.
const V = 40
const ctx2 = fakeCtx(V, V)
for (let y = 0; y < V; y++) put(ctx2.data, V, 20, y, 255)
drawStroke(ctx2, fillStroke({ x: 0.75, y: 0.5 }), V, V)
t('chạm nửa phải thì chỉ nửa phải được tô',
  alpha(ctx2.data, V, 30, 20) === 255 && alpha(ctx2.data, V, 10, 20) === 0)

// ── Xoá một mảng: value 0 ─────────────────────────────────────────────────
const ctx3 = fakeCtx(10, 10)
for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) put(ctx3.data, 10, x, y, 255)
drawStroke(ctx3, { ...fillStroke({ x: 0.5, y: 0.5 }), value: 0 }, 10, 10)
t('tô về 0 thì xoá mảng khỏi màn', alpha(ctx3.data, 10, 5, 5) === 0)

// ── Canvas quá lớn → lui về vẽ từ lưới, không đọc pixel ───────────────────
const huge = fakeCtx(4000, 4000, { withPixels: false })
drawStroke(huge, fillStroke({ x: 0.5, y: 0.5 }), 4000, 4000)
t('canvas quá lớn thì không đọc pixel', huge.calls.getImageData === 0)
t('canvas quá lớn vẫn vẽ được từ lưới', huge.calls.fill === 1)

// ── Chạm trúng nét → lui về vẽ từ lưới, không bỏ qua thao tác ────────────
const onLine = fakeCtx(10, 10)
for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) put(onLine.data, 10, x, y, 255)
drawStroke(onLine, fillStroke({ x: 0.5, y: 0.5 }), 10, 10)
t('mầm trúng nét thì lui về lưới chứ không mất thao tác',
  onLine.calls.putImageData === 0 && onLine.calls.fill === 1)

// ── Nét tô rỗng thì không vẽ gì ──────────────────────────────────────────
const empty = fakeCtx(10, 10)
drawStroke(empty, { tool: 'fill', point: { x: 0.5, y: 0.5 }, value: 1, runs: [] }, 10, 10)
t('nét tô không có dải nào thì bỏ qua',
  empty.calls.fill === 0 && empty.calls.putImageData === 0)

// -- Net bao ho khe nho hon mot o: luoi bit duoc, man thi khong ----------
// Luoi coi hinh la kin nen chi to ben trong; neu de to theo pixel thi muc chay
// ra nhuom den ca ban ve. Kich ban that: hinh NHO tren ban ve LON.
const BIG = 600
const ringAt = (ctx, w, x0, x1, gapFrom, gapTo) => {
  for (let x = x0; x <= x1; x++) { put(ctx.data, w, x, x0, 255); put(ctx.data, w, x, x1, 255) }
  for (let y = x0; y <= x1; y++) {
    put(ctx.data, w, x0, y, 255)
    if (gapFrom === undefined || y < gapFrom || y > gapTo) put(ctx.data, w, x1, y, 255)
  }
}
const runsFor = (a, b) => {
  const out = []
  for (let r = a; r <= b; r++) out.push({ row: r, c0: a, c1: b })
  return out
}

const leaky = fakeCtx(BIG, BIG)
ringAt(leaky, BIG, 20, 79, 45, 52)          // khung 60x60 o goc, ho mot khe
drawStroke(leaky, {
  tool: 'fill', point: { x: 50 / BIG, y: 50 / BIG }, value: 1,
  runs: runsFor(21, 78), gridRows: BIG, gridCols: BIG,
}, BIG, BIG)

t('muc chay ra ngoai thi bo, khong ghi pixel', leaky.calls.putImageData === 0)
t('va van to duoc bang cach ve tu luoi', leaky.calls.fill === 1)
t('nen ngoai hinh khong bi nhuom den', alpha(leaky.data, BIG, 500, 500) === 0)

// -- Hinh kin thi vanh sat net KHONG bi coi la tran ----------------------
const snug = fakeCtx(BIG, BIG)
ringAt(snug, BIG, 20, 79)
// Luoi dung som hon net that mot o moi ben -- dung canh sinh ra vien trang.
drawStroke(snug, {
  tool: 'fill', point: { x: 50 / BIG, y: 50 / BIG }, value: 1,
  runs: runsFor(22, 77), gridRows: BIG, gridCols: BIG,
}, BIG, BIG)

t('hinh kin van to theo pixel, khong bi tran chan nham',
  snug.calls.putImageData === 1 && snug.calls.fill === 0)
t('va vanh sat net duoc lap kin',
  alpha(snug.data, BIG, 21, 50) === 255 && alpha(snug.data, BIG, 78, 50) === 255)
t('vung to nam gon trong khung', alpha(snug.data, BIG, 500, 500) === 0)

console.log(fails ? `\n${fails} test FAIL` : '\nTất cả test PASS')
process.exit(fails ? 1 : 0)
