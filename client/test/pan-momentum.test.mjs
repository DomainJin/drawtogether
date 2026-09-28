// Công cụ bàn tay: vận tốc lúc nhấc tay + trôi theo đà. Kiểm bằng số.
import { releaseVelocity, momentumStep } from '../src/waterfall/panMomentum.js'
import { WATERFALL_UI as UI } from '../src/waterfall/config.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps

// ── releaseVelocity ──
t('0 mẫu → 0', releaseVelocity([], 100) === 0)
t('1 mẫu → 0 (chạm rồi nhấc, không trôi)', releaseVelocity([{ y: 10, t: 0 }], 100) === 0)
const steady = Array.from({ length: 11 }, (_, i) => ({ y: i * 8, t: i * 8 })) // 1 px/ms xuống
t('vuốt đều xuống 1 px/ms', near(releaseVelocity(steady, 100), 1), releaseVelocity(steady, 100).toFixed(3))
const up = steady.map((s) => ({ ...s, y: -s.y }))
t('vuốt lên → vận tốc âm', near(releaseVelocity(up, 100), -1))
// Vuốt nhanh rồi GIỮ YÊN 200ms mới nhấc: không được trôi.
const held = [...steady, { y: 80, t: 180 }, { y: 80, t: 280 }]
t('dừng tay rồi mới nhấc → 0', releaseVelocity(held, UI.HAND_VELOCITY_WINDOW_MS) === 0)
// Chỉ tính mẫu trong cửa sổ: đầu chậm, cuối nhanh → lấy tốc độ cuối.
const accel = [{ y: 0, t: 0 }, { y: 10, t: 200 }, { y: 60, t: 250 }, { y: 110, t: 300 }]
t('chỉ tính trong cửa sổ cuối', near(releaseVelocity(accel, 100), 1), releaseVelocity(accel, 100).toFixed(3))
t('hai mẫu cùng thời điểm → 0, không chia 0', releaseVelocity([{ y: 0, t: 5 }, { y: 9, t: 5 }], 100) === 0)

// ── momentumStep ──
const f = UI.HAND_FRICTION_PER_FRAME, min = UI.HAND_MIN_VELOCITY
const s1 = momentumStep(1, 1000 / 60, f, min)
t('1 khung 60Hz: vận tốc × ma sát', near(s1.velocity, f), s1.velocity.toFixed(4))
t('dịch chuyển = vận tốc mới × dt', near(s1.delta, s1.velocity * 1000 / 60))
// 60Hz và 120Hz phải trôi xa như nhau (sai số nhỏ do bước rời rạc).
const glide = (hz) => {
  let v = 1.5, dist = 0, steps = 0
  for (;;) {
    const s = momentumStep(v, 1000 / hz, f, min)
    if (s.done) break
    v = s.velocity; dist += s.delta; steps++
    if (steps > 10000) return Infinity
  }
  return dist
}
const d60 = glide(60), d120 = glide(120)
t('trôi hữu hạn rồi dừng', Number.isFinite(d60) && d60 > 0, `${d60.toFixed(0)}px`)
t('60Hz và 120Hz trôi xa gần bằng nhau (<3%)', Math.abs(d60 - d120) / d60 < 0.03, `${d60.toFixed(0)} vs ${d120.toFixed(0)}px`)
const glideUp = (() => { let v = -1.5, d = 0; for (;;) { const s = momentumStep(v, 1000 / 60, f, min); if (s.done) return d; v = s.velocity; d += s.delta } })()
t('vuốt lên trôi đối xứng (cùng quãng, ngược chiều)', near(glideUp, -d60, 1e-6), `${glideUp.toFixed(0)}px`)
const stop = momentumStep(min * 0.5, 16, f, min)
t('dưới ngưỡng → dừng, không dịch', stop.done && stop.velocity === 0 && stop.delta === 0)
t('vận tốc 0 → dừng ngay', momentumStep(0, 16, f, min).done)

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All pan-momentum tests passed')
