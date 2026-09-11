/** Chế độ chạy của nút Gửi, và cách chia một lượt chạy thành nhiều burst.
 *
 *  Ba chế độ, khác nhau đúng một con số — số vòng:
 *    single  : 1 vòng, gửi đúng một lượt hoạ tiết rồi thôi.
 *    default : DEFAULT_PLAY_REPEATS vòng (10), tự dừng.
 *    loop    : vô tận, chạy tới khi bấm Dừng.
 *
 *  Vì sao không nhét cả 10 vòng vào một gói rồi gửi một phát: số frame nhân
 *  lên 10 lần, vượt cả bộ đệm firmware lẫn ngưỡng attachment của socket.io.
 *  Nên lượt chạy được chia thành BURST — mỗi burst là một chuỗi frame liền
 *  mạch không quá MAX_FRAMES_PER_SEND, gửi xong thì hẹn giờ đúng lúc nó chạy
 *  hết để gửi burst kế tiếp. Chế độ lặp vô tận dùng chính cơ chế đó, chỉ là
 *  không bao giờ hết burst.
 *
 *  Toàn bộ file thuần tính toán — không socket, không timer, không React. Chỗ
 *  duy nhất dễ sai là số học chia burst, và số học thì test được. */
import { WATERFALL_CONFIG as CFG } from './config.js'
import { TS_CONFIG } from './valveCodec.js'

export const PLAY_MODES = {
  DEFAULT: 'default',
  SINGLE: 'single',
  LOOP: 'loop',
}

/** Thứ tự hiện trên giao diện, cũng là thứ tự nút trên dock bấm xoay vòng. */
export const PLAY_MODE_ORDER = [PLAY_MODES.DEFAULT, PLAY_MODES.SINGLE, PLAY_MODES.LOOP]

/** Nhãn dùng chung cho panel (desktop) và dock (điện thoại). Để cạnh chỗ định
 *  nghĩa chế độ, thay vì chép hai bản trong hai component rồi lệch nhau. */
export const PLAY_MODE_META = {
  [PLAY_MODES.DEFAULT]: {
    short: `${CFG.DEFAULT_PLAY_REPEATS}×`,
    label: 'Mặc định',
    hint: `Chạy ${CFG.DEFAULT_PLAY_REPEATS} vòng rồi tự dừng`,
  },
  [PLAY_MODES.SINGLE]: {
    short: '1×',
    label: 'Một lần',
    hint: 'Gửi đúng một vòng hoạ tiết',
  },
  [PLAY_MODES.LOOP]: {
    short: '∞',
    label: 'Lặp',
    hint: 'Lặp vô tận cho tới khi bấm Dừng',
  },
}

/** Giá trị lạ (localStorage cũ, người dùng sửa tay) rơi về mặc định thay vì
 *  làm hỏng lượt gửi — không có chế độ nào thì repeatsForMode trả NaN. */
export function normalizePlayMode(mode) {
  return PLAY_MODE_ORDER.includes(mode) ? mode : PLAY_MODES.DEFAULT
}

export function nextPlayMode(mode) {
  const i = PLAY_MODE_ORDER.indexOf(normalizePlayMode(mode))
  return PLAY_MODE_ORDER[(i + 1) % PLAY_MODE_ORDER.length]
}

/** Số vòng của một chế độ. Infinity là thật, không phải cờ giả: mọi phép so
 *  sánh "đã chạy đủ chưa" bên dưới đều đúng với nó. */
export function repeatsForMode(mode) {
  switch (normalizePlayMode(mode)) {
    case PLAY_MODES.SINGLE: return 1
    case PLAY_MODES.LOOP: return Infinity
    default: return CFG.DEFAULT_PLAY_REPEATS
  }
}

export function isEndless(mode) {
  return repeatsForMode(mode) === Infinity
}

/** Số frame "cứng" của mỗi burst: 3 frame đầu (config/reset/start) + 1 frame
 *  tắt hết ở cuối. Xem framesForRepeats trong valveCodec.js. */
export const BURST_OVERHEAD_FRAMES = 4

/** Một burst chứa được mấy vòng?
 *
 *  Hai trần cùng lúc:
 *   - Số frame: (maxFrames - overhead) / số frame một vòng.
 *   - Mốc thời gian: frame cuối burst nằm ở reps * cycleMs, mà mốc là uint32 và
 *     vùng trên cùng đã bị mấy mã điều khiển (TS_CONFIG/RESET/START) chiếm chỗ.
 *     Thực tế không bao giờ chạm tới (512 hàng × 300ms × 10 vòng mới hết 1,5
 *     triệu ms trên 4,29 tỉ), nhưng để hở thì một ngày nào đó hoạ tiết dài bất
 *     thường sẽ sinh ra frame mang đúng mã RESET và thiết bị reset giữa chừng.
 *
 *  Luôn trả ít nhất 1: một vòng dài quá trần vẫn phải gửi được, cắt đôi vòng ra
 *  thì hoạ tiết đứt ở giữa. */
export function repeatsPerBurst(framesPerCycle, cycleMs = 0, maxFrames = CFG.MAX_FRAMES_PER_SEND) {
  if (!framesPerCycle) return 1
  const byFrames = Math.floor((maxFrames - BURST_OVERHEAD_FRAMES) / framesPerCycle)
  const byClock = cycleMs > 0 ? Math.floor((TS_CONFIG - 1) / cycleMs) : Infinity
  return Math.max(1, Math.min(byFrames, byClock))
}

/** Số vòng cho burst kế tiếp. `remaining` = Infinity ở chế độ lặp. */
export function nextBurstRepeats(remaining, perBurst) {
  return Math.max(0, Math.min(perBurst, remaining))
}

/** Chờ bao lâu trước khi gửi burst kế tiếp.
 *
 *  Mốc là lúc burst hiện tại chạy hết, trừ đi BURST_SEND_LEAD_MS để bù độ trễ
 *  mạng. Không bao giờ âm: lead lớn hơn cả burst thì gửi ngay, chứ không phải
 *  gửi "trước khi bắt đầu". */
export function burstWaitMs(reps, cycleMs, leadMs = CFG.BURST_SEND_LEAD_MS) {
  return Math.max(0, reps * cycleMs - leadMs)
}

/** Mô tả lượt chạy để hiện lên giao diện: "vòng 3/10" hoặc "vòng 3 (lặp)". */
export function playProgressLabel(done, total) {
  if (total === Infinity) return `Vòng ${done + 1} — đang lặp`
  return `Vòng ${Math.min(done + 1, total)}/${total}`
}
