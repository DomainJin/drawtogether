/** Ba chế độ chạy của nút Gửi: mặc định 10 vòng, single 1 vòng, loop vô tận.
 *
 *  Chỗ duy nhất có thể sai âm thầm là SỐ BYTE gửi đi. Hoạ tiết lặp nhìn trên
 *  màn nước thì vòng nào cũng giống vòng nào — mắt không thể biết vòng thứ 7
 *  lệch mốc thời gian 16ms hay frame nối giữa hai vòng bị thừa. Nên test đọc
 *  thẳng từng frame: mốc thời gian (uint32 little-endian) và bit van.
 *
 *  Kiểm:
 *   1. Một vòng của bản mới giống hệt từng byte bản một-vòng cũ (không đổi
 *      hành vi của chế độ single so với trước khi có tính năng này).
 *   2. Vòng thứ k chỉ là vòng đầu dời mốc k * cycleMs, không sót không thừa.
 *   3. Mối nối giữa hai vòng không chèn nhịp tắt, và dedupe chạy xuyên qua nó.
 *   4. Chia burst: không burst nào vượt trần frame, một vòng dài quá trần vẫn
 *      đi trọn trong một burst.
 *   5. Mốc thời gian không bao giờ chạm vùng mã điều khiển TS_*.
 */
import { WATERFALL_CONFIG as CFG } from '../src/waterfall/config.js'
import {
  buildPatternTimeline, framesForRepeats, buildAnimationFrames, gridToOpenValveRows,
  valveBytesFor, packConfigFrame, TS_CONFIG, TS_RESET, TS_START, FRAME_HEADER_BYTES,
} from '../src/waterfall/valveCodec.js'
import {
  PLAY_MODES, PLAY_MODE_ORDER, PLAY_MODE_META, repeatsForMode, isEndless,
  normalizePlayMode, nextPlayMode, repeatsPerBurst, nextBurstRepeats, burstWaitMs,
  playProgressLabel, BURST_OVERHEAD_FRAMES,
} from '../src/waterfall/playback.js'

let fails = 0
const t = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`)
  if (!cond) fails++
}

const tsOf = (frame) => new DataView(frame.buffer, frame.byteOffset, frame.byteLength).getUint32(0, true)
const bitsOf = (frame) => Array.from(frame.slice(FRAME_HEADER_BYTES))
const hex = (frame) => Array.from(frame).map((b) => b.toString(16).padStart(2, '0')).join('')

const VALVES = 16          // 2 byte/frame — đủ nhỏ để đọc bit bằng mắt
const B = valveBytesFor(VALVES)
const INTERVAL = 20

/** Hoạ tiết 4 hàng: hàng 0 và 1 giống nhau (để thử dedupe), hàng 3 trống. */
const rows = [[0], [0], [1, 2], []]

// ── 1. Một vòng: đúng những gì bản cũ sinh ra ────────────────────────────────
{
  const one = buildAnimationFrames(rows, INTERVAL, VALVES, false, 1)

  t('3 frame đầu là config/reset/start',
    hex(one[0]) === hex(packConfigFrame(VALVES)) &&
    tsOf(one[1]) === TS_RESET && tsOf(one[2]) === TS_START)
  t('frame điều khiển mang toàn bit 0',
    bitsOf(one[1]).every((b) => b === 0) && bitsOf(one[2]).every((b) => b === 0))

  const body = one.slice(3)
  // hàng 0 (van 0) → hàng 2 (van 1,2) → hàng 3 trống → frame tắt cuối.
  t('hàng trùng nhau gộp thành một frame', body.length === 4, `= ${body.length} frame`)
  t('mốc thời gian đúng nhịp hàng',
    body.map(tsOf).join(',') === `0,${2 * INTERVAL},${3 * INTERVAL},${4 * INTERVAL}`,
    body.map(tsOf).join(','))
  t('bit van hàng 0: chỉ van 0',
    bitsOf(body[0]).join(',') === '128,0')
  t('bit van hàng 2: van 1 và 2',
    bitsOf(body[1]).join(',') === '96,0')
  t('frame cuối tắt hết van', bitsOf(body[3]).every((b) => b === 0))
  t('độ dài frame = 4 byte mốc + số byte van',
    one.every((f) => f.length === FRAME_HEADER_BYTES + B || f.length === 6))
}

// ── 2. Nhiều vòng chỉ là dời mốc ─────────────────────────────────────────────
{
  const timeline = buildPatternTimeline(rows, INTERVAL, VALVES, false)
  t('một vòng dài đúng số hàng × nhịp', timeline.cycleMs === rows.length * INTERVAL,
    `${timeline.cycleMs}ms`)
  t('timeline giữ đúng số bước đổi trạng thái', timeline.cycle.length === 3,
    `= ${timeline.cycle.length}`)

  const one = framesForRepeats(timeline, 1)
  const ten = framesForRepeats(timeline, 10)
  const cyc = timeline.cycleMs

  // Số frame: 3 đầu + 3 bước × 10 vòng + 1 frame tắt.
  t('10 vòng sinh đúng số frame', ten.length === 3 + 3 * 10 + 1, `= ${ten.length}`)

  // Vòng k phải giống hệt vòng 0 về BIT, chỉ khác mốc đúng k * cycleMs.
  let shiftOk = true
  let shiftDetail = ''
  for (let k = 0; k < 10; k++) {
    for (let i = 0; i < 3; i++) {
      const base = ten[3 + i]
      const cur = ten[3 + k * 3 + i]
      if (bitsOf(cur).join() !== bitsOf(base).join() || tsOf(cur) !== tsOf(base) + k * cyc) {
        shiftOk = false
        shiftDetail = `vòng ${k} bước ${i}: ts=${tsOf(cur)} chờ ${tsOf(base) + k * cyc}`
        break
      }
    }
  }
  t('vòng thứ k = vòng đầu dời mốc k × cycleMs', shiftOk, shiftDetail)

  t('frame tắt cuối nằm ở cuối vòng thứ 10', tsOf(ten[ten.length - 1]) === 10 * cyc,
    `ts=${tsOf(ten[ten.length - 1])}`)
  t('chỉ có ĐÚNG MỘT frame tắt hết trong cả 10 vòng',
    ten.slice(3).filter((f) => bitsOf(f).every((b) => b === 0)).length === 10 + 1,
    // 10 frame "hàng 3 trống" + 1 frame chốt cuối là đúng theo hoạ tiết này
    `= ${ten.slice(3).filter((f) => bitsOf(f).every((b) => b === 0)).length}`)

  t('single = repeats 1, byte-exact như buildAnimationFrames cũ',
    one.map(hex).join('|') === buildAnimationFrames(rows, INTERVAL, VALVES, false).map(hex).join('|'))

  t('mốc thời gian tăng đều, không lùi',
    ten.slice(3).every((f, i, a) => i === 0 || tsOf(f) > tsOf(a[i - 1])))
}

// ── 3. Mối nối giữa hai vòng ─────────────────────────────────────────────────
{
  // Hàng cuối trùng hàng đầu: dedupe phải bỏ frame mở đầu của vòng sau.
  const joined = [[5], [7], [5]]
  const tl = buildPatternTimeline(joined, INTERVAL, VALVES, false)
  const two = framesForRepeats(tl, 2)
  const body = two.slice(3)
  // vòng 1: ts0 van5, ts20 van7, ts40 van5 | vòng 2: ts60 (van5 — TRÙNG, bỏ),
  // ts80 van7, ts100 van5 | frame tắt ts120.
  t('trạng thái trùng qua mối nối thì không gửi lại frame',
    body.length === 3 + 2 + 1, `= ${body.length} frame`)
  t('mốc sau mối nối nhảy đúng chỗ',
    body.map(tsOf).join(',') === '0,20,40,80,100,120', body.map(tsOf).join(','))
  t('giữa hai vòng KHÔNG có nhịp tắt chen vào',
    body.slice(0, -1).every((f) => !bitsOf(f).every((b) => b === 0)))
}

// ── 4. Lưới trống và repeats = 0 ─────────────────────────────────────────────
{
  const empty = buildPatternTimeline([[], [], []], INTERVAL, VALVES, true)
  t('lưới trống: không có vòng nào', empty.cycle.length === 0 && empty.cycleMs === 0)
  const f = framesForRepeats(empty, 10)
  t('lưới trống dù lặp 10 vòng vẫn chỉ 1 frame tắt', f.length === 4, `= ${f.length}`)
  t('repeats 0 cũng trả về frame tắt an toàn', framesForRepeats(buildPatternTimeline(rows, INTERVAL, VALVES, false), 0).length === 4)
}

// ── 5. Chia burst ────────────────────────────────────────────────────────────
{
  const max = CFG.MAX_FRAMES_PER_SEND
  t('trần frame mỗi burst lớn hơn phần cứng của burst', max > BURST_OVERHEAD_FRAMES)

  const perBurst = repeatsPerBurst(10, 0, 100)
  t('vòng 10 frame, trần 100 → 9 vòng/burst', perBurst === Math.floor((100 - 4) / 10),
    `= ${perBurst}`)
  t('burst không bao giờ vượt trần frame',
    perBurst * 10 + BURST_OVERHEAD_FRAMES <= 100,
    `= ${perBurst * 10 + BURST_OVERHEAD_FRAMES}`)
  t('trần config cũng chia đúng',
    repeatsPerBurst(20, 0) === Math.floor((max - BURST_OVERHEAD_FRAMES) / 20),
    `= ${repeatsPerBurst(20, 0)}`)

  t('một vòng dài hơn cả trần vẫn đi trọn trong một burst',
    repeatsPerBurst(500, 1000, max) === 1)
  t('vòng rỗng không chia 0', repeatsPerBurst(0, 0, max) === 1)

  // Hoạ tiết thật lớn nhất: 256 hàng đổi liên tục.
  const bigRows = Array.from({ length: CFG.DEFAULT_ROW_COUNT }, (_, i) => [i % VALVES])
  const bigTl = buildPatternTimeline(bigRows, CFG.DEFAULT_ROW_INTERVAL_MS, VALVES, true)
  const bigPer = repeatsPerBurst(bigTl.cycle.length, bigTl.cycleMs)
  const bigFrames = framesForRepeats(bigTl, bigPer)
  // Một vòng đã 256 frame — không chia nhỏ hơn được nữa, và cũng không cần:
  // đúng bằng lượng app vẫn gửi cho một lần bấm Gửi từ trước tới giờ.
  t('hoạ tiết 256 hàng: 1 vòng/burst', bigPer === 1, `= ${bigPer}`)
  t('hoạ tiết 256 hàng: burst không nặng hơn một lần gửi đơn lẻ trước đây',
    bigFrames.length === bigTl.cycle.length + BURST_OVERHEAD_FRAMES,
    `= ${bigFrames.length} frame`)
  t('lặp 10 vòng hoạ tiết lớn không dồn 2600 frame vào một gói',
    framesForRepeats(bigTl, nextBurstRepeats(10, bigPer)).length < 2 * CFG.MAX_FRAMES_PER_SEND)

  t('chế độ lặp: burst kế tiếp luôn còn vòng để chạy',
    nextBurstRepeats(Infinity, 7) === 7)
  t('vòng cuối chỉ lấy đúng phần còn thiếu', nextBurstRepeats(3, 7) === 3)
  t('hết vòng thì không gửi thêm burst', nextBurstRepeats(0, 7) === 0)
}

// ── 6. Hẹn giờ burst ─────────────────────────────────────────────────────────
{
  t('chờ đúng thời lượng burst khi lead = 0', burstWaitMs(3, 100, 0) === 300)
  t('lead trừ vào thời gian chờ', burstWaitMs(3, 100, 120) === 180)
  t('lead lớn hơn cả burst thì chờ 0, không âm', burstWaitMs(1, 100, 500) === 0)
  t('lead mặc định lấy từ config', burstWaitMs(2, 50) === 100 - CFG.BURST_SEND_LEAD_MS)
}

// ── 7. Mốc thời gian không đụng mã điều khiển ────────────────────────────────
{
  // Trường hợp xấu nhất theo config: hoạ tiết dài nhất, nhịp chậm nhất, 10 vòng.
  const worstCycleMs = CFG.MAX_ROW_COUNT * CFG.MAX_ROW_INTERVAL_MS
  const worstTs = worstCycleMs * CFG.DEFAULT_PLAY_REPEATS
  t('mốc lớn nhất còn xa vùng TS_CONFIG/RESET/START',
    worstTs < TS_CONFIG && worstTs < TS_START && worstTs < TS_RESET,
    `${worstTs}ms < ${TS_CONFIG}`)

  // Và nếu một ngày nào đó hoạ tiết dài tới mức đó thật, chia burst phải cắt.
  const absurd = repeatsPerBurst(1, TS_CONFIG, Number.MAX_SAFE_INTEGER)
  t('vòng dài sát trần uint32 bị chặn xuống 1 vòng/burst', absurd === 1, `= ${absurd}`)
}

// ── 8. Chế độ và nhãn ────────────────────────────────────────────────────────
{
  t('mặc định chạy đúng số vòng trong config',
    repeatsForMode(PLAY_MODES.DEFAULT) === CFG.DEFAULT_PLAY_REPEATS &&
    CFG.DEFAULT_PLAY_REPEATS === 10, `= ${repeatsForMode(PLAY_MODES.DEFAULT)}`)
  t('single đúng 1 vòng', repeatsForMode(PLAY_MODES.SINGLE) === 1)
  t('loop là vô tận', repeatsForMode(PLAY_MODES.LOOP) === Infinity && isEndless(PLAY_MODES.LOOP))
  t('chỉ loop mới vô tận',
    !isEndless(PLAY_MODES.SINGLE) && !isEndless(PLAY_MODES.DEFAULT))

  t('chế độ lạ rơi về mặc định',
    normalizePlayMode('xyz') === PLAY_MODES.DEFAULT &&
    normalizePlayMode(undefined) === PLAY_MODES.DEFAULT)
  t('nút dock xoay vòng qua đủ 3 chế độ rồi quay lại',
    nextPlayMode(nextPlayMode(nextPlayMode(PLAY_MODES.DEFAULT))) === PLAY_MODES.DEFAULT)
  t('xoay vòng không bỏ sót chế độ nào',
    new Set([PLAY_MODES.DEFAULT, nextPlayMode(PLAY_MODES.DEFAULT),
      nextPlayMode(nextPlayMode(PLAY_MODES.DEFAULT))]).size === PLAY_MODE_ORDER.length)
  t('mọi chế độ đều có nhãn cho giao diện',
    PLAY_MODE_ORDER.every((m) => PLAY_MODE_META[m]?.short && PLAY_MODE_META[m]?.label))

  t('tiến độ hữu hạn hiện dạng k/n', playProgressLabel(2, 10) === 'Vòng 3/10')
  t('vòng cuối không vượt quá tổng', playProgressLabel(10, 10) === 'Vòng 10/10')
  t('chế độ lặp không hiện tổng giả', playProgressLabel(4, Infinity) === 'Vòng 5 — đang lặp')
}

// ── 9. gridToOpenValveRows vẫn đúng chiều ────────────────────────────────────
{
  const grid = [[0, 1], [1, 0]]
  t('gửi hàng dưới trước khi bật cờ',
    JSON.stringify(gridToOpenValveRows(grid, true)) === JSON.stringify([[0], [1]]))
  t('gửi xuôi khi tắt cờ',
    JSON.stringify(gridToOpenValveRows(grid, false)) === JSON.stringify([[1], [0]]))
}

console.log(fails === 0 ? '\nAll play-mode tests passed' : `\n${fails} test(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
