// Dòng thời gian clip dựng lại (SPEC §8) + spotlight không bị kéo dài khi hàng đợi bận.
import { replayOffsets, replayEffect, suggestSpanSeconds, estimateClipMs, evenFloor } from '../src/performance/replaySchedule.js'
import { createScene, stepScene, sceneIsSettled, spotlightDuration } from '../src/performance/scene.js'
import { CLIP_CONFIG as C, PERF_CONFIG as P } from '../src/performance/config.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra !== '' ? '  ' + JSON.stringify(extra) : ''}`)
  if (!cond) fails++
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps

t('0 chữ ký → []', replayOffsets([], { mode: 'even', spanMs: 1000 }).length === 0)
t('1 chữ ký → [0]', JSON.stringify(replayOffsets([500], { mode: 'real', spanMs: 1000 })) === '[0]')
const even = replayOffsets([0, 10, 1000, 1001], { mode: 'even', spanMs: 3000 })
t('even: cách đều, đầu 0, cuối = span', JSON.stringify(even) === '[0,1000,2000,3000]', even)

// Thời gian thật: 3 khoảng 10s, rồi 1 quãng vắng 30 phút (MC nói), rồi 10s
const T = [0, 10_000, 20_000, 30_000, 30_000 + 1_800_000, 30_000 + 1_810_000]
const real = replayOffsets(T, { mode: 'real', spanMs: 60_000 })
const gaps = real.slice(1).map((v, i) => v - real[i])
t('real: đầu 0, cuối = span', real[0] === 0 && near(real[5], 60_000), real)
t('real: tăng dần', real.every((v, i) => i === 0 || v >= real[i - 1]))
t('real: quãng vắng 30 phút bị chặn còn ≤ REAL_GAP_CAP × khoảng thường', near(gaps[3], gaps[0] * C.REAL_GAP_CAP), gaps)
t('real: các khoảng thường bằng nhau', near(gaps[0], gaps[1]) && near(gaps[1], gaps[4]))
const burst = replayOffsets([0, 0, 0], { mode: 'real', spanMs: 2000 })
t('real: mọi chữ ký cùng ms → rơi về cách đều', JSON.stringify(burst) === '[0,1000,2000]', burst)
const unsorted = replayOffsets([0, 5000, 4000, 9000], { mode: 'real', spanMs: 900 })
t('real: thời gian lùi (lệch đồng hồ) không tạo offset âm/lùi', unsorted.every((v, i) => i === 0 || v >= unsorted[i - 1]), unsorted)

const eff = { spotlight: true, spotlightMs: 4000, entranceMs: 1800 }
t('replayEffect: dày → tắt spotlight', replayEffect(eff, C.SPOTLIGHT_MIN_INTERVAL_MS - 1).spotlight === false)
t('replayEffect: thưa vừa → spotlight ≤ khoảng cách', replayEffect(eff, 1200).spotlightMs === 1200)
t('replayEffect: rất thưa → giữ spotlightMs gốc', replayEffect(eff, 10_000).spotlightMs === 4000)
t('replayEffect: spotlight tắt sẵn → giữ nguyên object', replayEffect({ ...eff, spotlight: false }, 5000).spotlight === false)

t('suggestSpan 163 chữ ký → kẹp DEFAULT_MAX', suggestSpanSeconds(163) === C.DEFAULT_MAX_SPAN_S)
t('suggestSpan 1 chữ ký → MIN', suggestSpanSeconds(1) === C.MIN_SPAN_S)
t('suggestSpan 20 → 24s', suggestSpanSeconds(20) === 24)
t('estimateClipMs cộng đủ phần', estimateClipMs(10_000, eff) === C.INTRO_MS + 10_000 + 1800 + 4000 + C.OUTRO_MS)
t('evenFloor: 3072→3072, 897→896, 1→2', evenFloor(3072) === 3072 && evenFloor(897) === 896 && evenFloor(1) === 2)

// Bug cũ: spotlightMs < SPOTLIGHT_MIN_MS mà hàng đợi bận → bị KÉO DÀI lên MIN.
t('spotlightDuration: hàng bận không bao giờ dài hơn base', spotlightDuration(1000, 10) === 1000, spotlightDuration(1000, 10))
t('spotlightDuration: hàng bận, base dài → một nửa', spotlightDuration(4000, 10) === 2000)

// sceneIsSettled: mô phỏng clip — chữ ký đến dần, cảnh phải lắng sau chữ ký cuối
const cfg = {
  layout: { mode: 'grid', maxVisible: 200, gap: 0.02, padding: 0.04, floatSize: 0.2, floatSpeed: 0.05 },
  effect: { entrance: 'draw', entranceMs: 1500, spotlight: true, spotlightMs: 1200, spotlightScale: 0.5 },
}
const sigs = Array.from({ length: 30 }, (_, i) => ({ id: 's' + i, status: 'visible', aspect: 2, name: '', strokes: [[0, 0, 0, 1, 1, 10]], at: C.INTRO_MS + i * 1300 }))
const scene = createScene()
const live = []
let settledAt = null, maxQueue = 0
for (let ms = 0; ms < 60_000; ms += 1000 / 30) {
  while (live.length < sigs.length && sigs[live.length].at <= ms) live.push(sigs[live.length])
  stepScene(scene, { sigs: live, config: cfg, W: 3072, H: 896, now: ms, aspectOf: () => 2 })
  maxQueue = Math.max(maxQueue, scene.queue.length)
  if (live.length === sigs.length && settledAt === null && sceneIsSettled(scene)) settledAt = ms
}
t('clip mô phỏng: hàng đợi spotlight không dồn (≤ 1)', maxQueue <= 1, maxQueue)
const last = sigs[sigs.length - 1].at
t('clip mô phỏng: cảnh lắng sau chữ ký cuối, trong vài giây', settledAt !== null && settledAt > last && settledAt - last < 5000, { settledAt, last })
t('cảnh mới tạo là đã lắng', sceneIsSettled(createScene()))

if (fails) { console.error(`${fails} test FAIL`); process.exit(1) }
console.log('All perf-replay tests passed')
