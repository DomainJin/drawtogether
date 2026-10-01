/** Dòng thời gian của clip dựng lại — SPEC §8. Pure. */
import { CLIP_CONFIG as C } from './config.js'

const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/** Thời điểm (ms, tính từ chữ ký đầu) từng chữ ký xuất hiện trong clip.
 *  `times` = createdAt tăng dần. Chữ ký đầu ở 0, chữ ký cuối ở `spanMs`. */
export function replayOffsets(times, { mode, spanMs }) {
  const n = times.length
  if (n === 0) return []
  if (n === 1 || spanMs <= 0) return times.map(() => 0)

  if (mode === 'real') {
    const gaps = []
    for (let i = 1; i < n; i++) gaps.push(Math.max(0, times[i] - times[i - 1]))
    // Chặn quãng vắng (MC nói, nghỉ giải lao) để clip không có đoạn trống dài.
    const cap = Math.max(1, median(gaps) * C.REAL_GAP_CAP)
    const capped = gaps.map((g) => Math.min(g, cap))
    const total = capped.reduce((a, b) => a + b, 0)
    if (total > 0) {
      const out = [0]
      let acc = 0
      for (const g of capped) {
        acc += g
        out.push((acc / total) * spanMs)
      }
      return out
    }
    // Mọi chữ ký cùng một ms (dữ liệu nhập tay) → rơi về cách đều.
  }
  return times.map((_, i) => (i * spanMs) / (n - 1))
}

/** Hiệu ứng dùng trong clip: chữ ký đến dày thì tắt spotlight (hàng đợi sẽ dồn
 *  vô hạn), thưa thì spotlight không dài hơn khoảng cách giữa hai chữ ký. */
export function replayEffect(effect, intervalMs) {
  if (!effect.spotlight) return effect
  if (intervalMs < C.SPOTLIGHT_MIN_INTERVAL_MS) return { ...effect, spotlight: false }
  return { ...effect, spotlightMs: Math.min(effect.spotlightMs, Math.round(intervalMs)) }
}

/** Độ dài phần ký gợi ý (giây) cho n chữ ký. */
export function suggestSpanSeconds(n) {
  const s = Math.round((n * C.SUGGEST_MS_PER_SIG) / 1000)
  return Math.min(C.DEFAULT_MAX_SPAN_S, Math.max(C.MIN_SPAN_S, s))
}

/** Ước lượng độ dài clip (ms) — để hiện cho người dùng và tính % tiến độ. Clip
 *  thật dừng khi cảnh lắng, có thể ngắn hơn một chút. */
export function estimateClipMs(spanMs, effect) {
  return C.INTRO_MS + spanMs + effect.entranceMs + (effect.spotlight ? effect.spotlightMs : 0) + C.OUTRO_MS
}

/** H.264 bắt buộc cạnh chẵn. */
export const evenFloor = (v) => Math.max(2, Math.floor(v / 2) * 2)
