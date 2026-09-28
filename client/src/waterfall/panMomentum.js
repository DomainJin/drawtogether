/** Toán "vuốt rồi trôi" cho công cụ bàn tay. Thuần — không DOM, không rAF —
 *  để test được bằng số. Đơn vị: px, ms; vận tốc px/ms, dương = ngón đi xuống. */

const FRAME_MS = 1000 / 60

/** Vận tốc ngón tay lúc nhấc, trung bình trong `windowMs` cuối.
 *  @param {{y:number,t:number}[]} samples theo thứ tự thời gian */
export function releaseVelocity(samples, windowMs) {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let first = last
  for (let i = samples.length - 2; i >= 0; i--) {
    if (last.t - samples[i].t > windowMs) break
    first = samples[i]
  }
  const dt = last.t - first.t
  return dt > 0 ? (last.y - first.y) / dt : 0
}

/** Một bước trôi sau `dtMs`. Ma sát tính theo thời gian thực chứ không theo
 *  số khung, để màn 120Hz và 60Hz trôi xa như nhau.
 *  @returns {{ velocity: number, delta: number, done: boolean }} */
export function momentumStep(velocity, dtMs, frictionPerFrame, minVelocity) {
  const next = velocity * Math.pow(frictionPerFrame, dtMs / FRAME_MS)
  const done = Math.abs(next) < minVelocity
  return { velocity: done ? 0 : next, delta: done ? 0 : next * dtMs, done }
}
