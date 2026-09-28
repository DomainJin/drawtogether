// Performance mode — core pure: codec nét, bố cục chữ ký, lưới, trôi, hiệu ứng, cảnh.
import { simplifyStroke, roundStroke, strokesBounds, totalPoints, signatureDuration, encodeStrokes } from '../src/performance/strokeCodec.js'
import { signatureLayout, fitLayout, inkMargin } from '../src/performance/signatureLayout.js'
import { fitFrame, fitRect, qrPlacement, canvasPixelScale } from '../src/performance/stageGeometry.js'
import { gridLayout } from '../src/performance/gridLayout.js'
import { createFloater, stepFloater, hashString, mulberry32 } from '../src/performance/floatMotion.js'
import { entranceState, SETTLED } from '../src/performance/entrance.js'
import { createScene, stepScene, spotlightDuration, visibleSignatures } from '../src/performance/scene.js'
import { PERF_CONFIG as P } from '../src/performance/config.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

// ── strokeCodec ─────────────────────────────────────────────────────────────
{
  const line = []
  for (let i = 0; i <= 100; i++) line.push(i / 100, 0.5, i * 10)
  const s = simplifyStroke(line, 0.001, 2)
  t('RDP: đường thẳng 101 điểm → 2 điểm đầu/cuối', s.length === 6 && s[0] === 0 && s[3] === 1 && s[5] === 1000, s)

  const corner = [0, 0, 0, 0.25, 0, 5, 0.5, 0, 10, 0.5, 0.5, 15, 0.5, 1, 20]
  const c = simplifyStroke(corner, 0.001, 1)
  t('RDP: giữ đỉnh góc vuông + t của nó', c.length === 9 && c[3] === 0.5 && c[4] === 0 && c[5] === 10, c)

  // Lệch 0.01 theo x (pad x ∈ [0,1]) với aspect 2 = 0.02 pad units: ε=0.015 phải giữ lại.
  const bump = [0, 0.5, 0, 0.5, 0.5, 5, 0.51, 0.5, 6, 0.52, 0.5, 7, 1, 0.5, 10]
  const zig = [0, 0.5, 0, 0.5, 0.52, 5, 1, 0.5, 10]
  t('RDP: đo lệch trên trục y như nhau mọi aspect', simplifyStroke(zig, 0.015, 1).length === 9 && simplifyStroke(zig, 0.025, 1).length === 6)
  t('RDP: điểm thẳng hàng bỏ được', simplifyStroke(bump, 0.001, 2).length === 6)
  t('RDP: ≤ 2 điểm giữ nguyên', simplifyStroke([0.1, 0.1, 0], 0.01).length === 3 && simplifyStroke([0, 0, 0, 1, 1, 5], 0.01).length === 6)
  t('RDP: epsilon 0 → giữ nguyên', simplifyStroke(line, 0).length === line.length)

  const big = []
  for (let i = 0; i < 20000; i++) big.push(Math.random(), Math.random(), i)
  let okBig = true
  try { simplifyStroke(big, 0.001, 2) } catch { okBig = false }
  t('RDP: 20000 điểm không tràn stack', okBig)

  t('roundStroke: 4 chữ số, t nguyên', JSON.stringify(roundStroke([0.123456, 0.98765, 3.6])) === '[0.1235,0.9877,4]')
  t('totalPoints', totalPoints([[0, 0, 0, 1, 1, 1], [0, 0, 0]]) === 3)
  const b = strokesBounds([[0.1, 0.2, 0, 0.5, 0.8, 1]], 2)
  t('bounds nhân aspect cho x', near(b.minX, 0.2) && near(b.maxX, 1) && near(b.minY, 0.2) && near(b.maxY, 0.8), b)
  t('bounds rỗng → null', strokesBounds([], 2) === null)
  t('duration = t lớn nhất', signatureDuration([[0, 0, 0, 1, 1, 300], [0, 0, 500]]) === 500)
  t('encodeStrokes bỏ nét rỗng', encodeStrokes([[], [0.1, 0.1, 0]], 0.001, 2).length === 1)
}

// ── signatureLayout ────────────────────────────────────────────────────────
const style = (over = {}) => ({
  ink: { width: 0.02, glow: 0, ...over.ink },
  name: { show: true, size: 0.2, ...over.name },
})
const measure = (text, size) => text.length * size * 0.5
{
  const sig = { aspect: 2, name: '', strokes: [[0.1, 0.2, 0, 0.6, 0.7, 10]] }
  const L0 = signatureLayout(sig, style(), measure)
  const m = inkMargin(style())
  t('layout không tên: w = bbox + 2 lề', near(L0.w, 1.0 + 2 * m) && near(L0.h, 0.5 + 2 * m) && L0.name === null, L0)
  t('layout: glow tăng lề', inkMargin(style({ ink: { glow: 1 } })) > m)

  const L1 = signatureLayout({ ...sig, name: 'An' }, style(), measure)
  t('layout có tên: cao hơn, tên nằm dưới nét', L1.h > L0.h && L1.name.y > L0.h && near(L1.name.x, L1.w / 2), L1)
  const L2 = signatureLayout({ ...sig, name: 'Một cái tên rất rất rất dài' }, style(), measure)
  t('tên rộng hơn nét → hộp theo tên, nét căn giữa', L2.w > L0.w && L2.ink.x > m)
  const L3 = signatureLayout({ ...sig, name: 'An' }, style({ name: { show: false } }), measure)
  t('name.show=false → bỏ tên', L3.name === null)
  const L4 = signatureLayout({ ...sig, name: '   ' }, style(), measure)
  t('tên toàn khoảng trắng → bỏ tên', L4.name === null)

  const f = fitLayout({ w: 2, h: 1 }, { x: 10, y: 10, w: 100, h: 100 })
  t('fitLayout: giữ tỉ lệ, căn giữa', near(f.scale, 50) && near(f.x, 10) && near(f.y, 35), f)
  t('fitLayout: hộp rỗng → scale 0', fitLayout({ w: 0, h: 0 }, { x: 0, y: 0, w: 10, h: 10 }).scale === 0)
}

// ── stageGeometry ──────────────────────────────────────────────────────────
{
  const a = fitFrame(1000, 1000, 1920, 1080)
  t('fitFrame: letterbox dọc', near(a.scale, 1000 / 1920) && near(a.x, 0) && near(a.y, (1000 - 1080 * a.scale) / 2), a)
  const b = fitFrame(1920, 1080, 1920, 1080)
  t('fitFrame: vừa khít → scale 1', b.scale === 1 && b.x === 0 && b.y === 0)
  t('fitFrame: 0 → an toàn', fitFrame(0, 100, 1920, 1080).scale === 0)

  const cover = fitRect(1000, 500, 100, 100, 'cover')
  t('fitRect cover: phủ kín, tràn ngang', near(cover.h, 100) && near(cover.w, 200) && near(cover.x, -50), cover)
  const contain = fitRect(1000, 500, 100, 100, 'contain')
  t('fitRect contain: vừa trong, lề dọc', near(contain.w, 100) && near(contain.h, 50) && near(contain.y, 25), contain)
  t('fitRect stretch', JSON.stringify(fitRect(1, 2, 30, 40, 'stretch')) === JSON.stringify({ x: 0, y: 0, w: 30, h: 40 }))

  const q = qrPlacement(1920, 1080, { size: 0.2, corner: 'br', caption: 'x' })
  t('QR góc phải-dưới nằm trong vùng', q.x + q.size <= 1920 && q.y + q.size + q.captionH <= 1080 && q.x > 1000 && q.y > 500, q)
  const q2 = qrPlacement(1920, 1080, { size: 0.2, corner: 'tl', caption: '' })
  t('QR góc trái-trên, không caption', q2.x < 100 && q2.y < 100 && q2.captionH === 0, q2)

  t('pixelScale: preview nhỏ → < 1', near(canvasPixelScale(0.3, 2), 0.6))
  t('pixelScale: không vượt 1', canvasPixelScale(1, 2) === 1)
}

// ── gridLayout ─────────────────────────────────────────────────────────────
{
  t('grid n=0 → rỗng', gridLayout(0, 1920, 1080, 2).slots.length === 0)
  const g1 = gridLayout(1, 1920, 1080, 2, 0, 0)
  t('grid n=1: một ô lớn nhất theo tỉ lệ, căn giữa', g1.cols === 1 && near(g1.slots[0].w, 1920) && near(g1.slots[0].h, 960) && near(g1.slots[0].y, 60), g1.slots[0])
  for (const n of [2, 3, 7, 13, 40, 100, 500]) {
    const g = gridLayout(n, 1920, 1080, 2.5, 20, 40)
    const inside = g.slots.every((s) => s.x >= 40 - 1e-6 && s.y >= 40 - 1e-6 && s.x + s.w <= 1880 + 1e-6 && s.y + s.h <= 1040 + 1e-6)
    let overlap = false
    for (let i = 0; i < g.slots.length && !overlap; i++) {
      for (let j = i + 1; j < g.slots.length; j++) {
        const a = g.slots[i], b = g.slots[j]
        if (a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6) { overlap = true; break }
      }
    }
    t(`grid n=${n}: đủ ô, trong vùng (trừ padding), không chồng`, g.slots.length === n && inside && !overlap, { cols: g.cols, rows: g.rows })
  }
  const g3 = gridLayout(3, 1000, 1000, 1, 0, 0)
  t('grid 3 ô vuông trong vùng vuông → 2 cột, hàng cuối căn giữa', g3.cols === 2 && near(g3.slots[2].x, 250), g3.slots)
}

// ── floatMotion ────────────────────────────────────────────────────────────
{
  t('hash tất định', hashString('abc') === hashString('abc') && hashString('abc') !== hashString('abd'))
  const r = mulberry32(42)
  const vals = Array.from({ length: 1000 }, r)
  t('mulberry32 ∈ [0,1)', vals.every((v) => v >= 0 && v < 1))
  const f = createFloater('sig-1', 1920, 1080, 400, 200)
  const f2 = createFloater('sig-1', 1920, 1080, 400, 200)
  t('floater tất định theo id', JSON.stringify(f) === JSON.stringify(f2))
  let inside = true
  for (let i = 0; i < 20000; i++) {
    stepFloater(f, 1 / 60, 300, 1920, 1080, 400, 200)
    if (f.x < 0 || f.y < 0 || f.x > 1520 || f.y > 880) { inside = false; break }
  }
  t('floater dội mép, không ra ngoài sau 20000 bước', inside, { x: f.x, y: f.y })
  const big = createFloater('x', 100, 100, 300, 50)
  stepFloater(big, 0.1, 100, 100, 100, 300, 50)
  t('vật rộng hơn vùng → căn giữa ngang', near(big.x, -100))
  const still = createFloater('s', 1000, 1000, 100, 100)
  const x0 = still.x
  stepFloater(still, 1, 0, 1000, 1000, 100, 100)
  t('tốc độ 0 → đứng yên', still.x === x0)
}

// ── entrance ───────────────────────────────────────────────────────────────
{
  t('entrance p≥1 → SETTLED', entranceState('zoom', 1) === SETTLED && entranceState('fade', 5) === SETTLED)
  t('fade p=0 → trong suốt', entranceState('fade', 0).alpha === 0)
  t('draw p=0.5 → đang viết một nửa', entranceState('draw', 0.5).drawProgress === 0.5 && entranceState('draw', 0.5).alpha === 1)
  t('fly p=0 → dưới vị trí', entranceState('fly', 0).dy > 0)
  t('zoom p=0 → nhỏ', entranceState('zoom', 0).scale < 0.5)
  t('hiệu ứng lạ → SETTLED', entranceState('xyz', 0.3) === SETTLED)
}

// ── scene ──────────────────────────────────────────────────────────────────
const cfg = (over = {}) => ({
  layout: { mode: 'grid', maxVisible: 40, gap: 0.02, padding: 0.04, floatSize: 0.2, floatSpeed: 0.05, ...over.layout },
  effect: { entrance: 'fade', entranceMs: 1000, spotlight: true, spotlightMs: 3000, spotlightScale: 0.5, ...over.effect },
})
const mk = (id, status = 'visible') => ({ id, status, aspect: 2, strokes: [[0, 0, 0, 1, 1, 10]], name: '' })
const run = (scene, sigs, config, from, to, step = 16) => {
  let items
  for (let now = from; now <= to; now += step) items = stepScene(scene, { sigs, config, W: 1920, H: 1080, now, aspectOf: () => 2 })
  return items
}
{
  t('spotlightDuration: hàng ngắn giữ nguyên', spotlightDuration(4000, 2) === 4000)
  t('spotlightDuration: hàng dài → một nửa, ≥ MIN', spotlightDuration(4000, 10) === 2000 && spotlightDuration(2000, 10) === P.SPOTLIGHT_MIN_MS)
  const vs = visibleSignatures([mk('a'), mk('b', 'hidden'), mk('c', 'pending'), mk('d'), mk('e')], 2)
  t('visible: bỏ hidden/pending, giữ N mới nhất', vs.map((s) => s.id).join() === 'd,e')

  const scene = createScene()
  const sigs = [mk('a'), mk('b'), mk('c')]
  let items = run(scene, sigs, cfg(), 0, 0)
  t('mở show: chữ ký có sẵn hiện ngay, không diễn', items.length === 3 && items.every((i) => i.alpha === 1 && i.drawProgress === 1 && !i.spot))

  sigs.push(mk('d'))
  items = run(scene, sigs, cfg(), 16, 16)
  const d = items.find((i) => i.id === 'd')
  t('chữ ký mới → spotlight, vẽ trên cùng', d && d.spot && items[items.length - 1].id === 'd')
  t('spotlight cao ≈ 0.5 × H, ở giữa', d && near(d.h, 540, 1) && near(d.y + d.h / 2, 540, 1), d)
  t('fade: mới vào còn mờ', d.alpha < 0.2, d.alpha)

  items = run(scene, sigs, cfg(), 32, 1500)
  const others = items.filter((i) => !i.spot)
  t('đang spotlight → các chữ ký khác lùi mờ về SPOTLIGHT_BACKDROP_ALPHA', others.length === 3 && others.every((i) => near(i.alpha, P.SPOTLIGHT_BACKDROP_ALPHA, 0.02)), others.map((i) => i.alpha))

  sigs.push(mk('e'))
  items = run(scene, sigs, cfg(), 1516, 1600)
  t('chữ ký thứ 2 chờ, chưa hiện khi cái trước đang spotlight', !items.find((i) => i.id === 'e'))

  items = run(scene, sigs, cfg(), 1616, 3100)
  const e = items.find((i) => i.id === 'e')
  t('hết lượt d → tới e', e && e.spot)

  items = run(scene, sigs, cfg(), 3116, 9000)
  const slots = gridLayout(5, 1920, 1080, 2, 0.02 * 1080, 0.04 * 1080).slots
  const d2 = items.find((i) => i.id === 'd')
  t('hết spotlight → về đúng ô lưới', d2 && !d2.spot && near(d2.x, slots[3].x, 1) && near(d2.y, slots[3].y, 1) && near(d2.w, slots[3].w, 1), { d2, slot: slots[3] })
  t('mọi item đã ổn định (alpha 1)', items.every((i) => i.alpha === 1))

  // Ẩn chữ ký → biến mất; spotlight tắt → chữ ký mới vào ô ngay.
  sigs[0].status = 'hidden'
  items = run(scene, sigs, cfg({ effect: { spotlight: false } }), 9016, 9016)
  t('ẩn → không vẽ', !items.find((i) => i.id === 'a') && items.length === 4)
  sigs.push(mk('f'))
  items = run(scene, sigs, cfg({ effect: { spotlight: false } }), 9032, 9032)
  const fItem = items.find((i) => i.id === 'f')
  t('spotlight tắt → vào ô luôn, vẫn có hiệu ứng', fItem && !fItem.spot && fItem.alpha < 1)

  // Float: mọi item trong vùng
  const fs = createScene()
  const many = Array.from({ length: 30 }, (_, i) => mk('s' + i))
  items = run(fs, many, cfg({ layout: { mode: 'float' } }), 0, 20000, 33)
  const bobPad = P.FLOAT_BOB * 0.2 * 1080 + 1
  t('float: 30 chữ ký đều nằm trong vùng', items.length === 30 && items.every((i) => i.x >= -1 && i.y >= -bobPad && i.x + i.w <= 1921 && i.y + i.h <= 1080 + bobPad))
  t('float: cao = floatSize × H', items.every((i) => near(i.h, 216, 1)))

  // maxVisible
  const ms = createScene()
  items = run(ms, many, cfg({ layout: { maxVisible: 5 } }), 0, 0)
  t('maxVisible=5 → 5 chữ ký mới nhất', items.length === 5 && items.map((i) => i.id).join() === 's25,s26,s27,s28,s29')
}

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-core tests passed')
