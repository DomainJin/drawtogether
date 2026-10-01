/** Mô hình cảnh của màn show — SPEC §6. Pure: không canvas, không DOM.
 *
 *  Mỗi frame: danh sách chữ ký + config + thời điểm → danh sách "item" cần vẽ
 *  (hộp, alpha, tiến độ viết). Renderer chỉ việc vẽ các item. Tách ra để test
 *  được bằng số: chữ ký mới có vào spotlight không, có về đúng ô không, có trôi
 *  ra ngoài vùng không.
 *
 *  Vị trí mọi chữ ký được làm mượt về đích → thêm chữ ký làm lưới dồn lại, hết
 *  spotlight, đổi grid↔float đều là chuyển động, không nhảy cóc. */
import { PERF_CONFIG as P } from './config.js'
import { gridLayout } from './gridLayout.js'
import { createFloater, stepFloater } from './floatMotion.js'
import { entranceState, SETTLED } from './entrance.js'

const MAX_DT = 0.1 // giây — tab bị ẩn rồi hiện lại không làm mọi thứ "nhảy" một bước dài

export function createScene() {
  return {
    entries: new Map(), // id → { id, arrivedAt, animate, rect, floater }
    queue: [],          // id chờ spotlight
    spot: null,         // { id, until }
    initialized: false,
    lastNow: null,
    backdrop: 1,        // độ đậm các chữ ký khác, làm mượt về đích mỗi frame
  }
}

/** Hàng đợi dài → rút ngắn để không ai phải chờ cả phút mới thấy chữ ký mình. */
export function spotlightDuration(baseMs, queueLen) {
  if (queueLen <= P.SPOTLIGHT_BUSY_QUEUE) return baseMs
  // Không bao giờ dài hơn base: base đã dưới MIN thì giữ nguyên base.
  return Math.min(baseMs, Math.max(P.SPOTLIGHT_MIN_MS, baseMs / 2))
}

/** Cảnh đã lắng: không còn ai chờ/đang spotlight, không còn hiệu ứng vào nào
 *  chạy dở. (Chế độ trôi vẫn chuyển động — đó là trạng thái nghỉ của nó.) */
export function sceneIsSettled(scene) {
  if (scene.queue.length || scene.spot || scene.backdrop !== 1) return false
  for (const e of scene.entries.values()) if (e.animate) return false
  return true
}

/** Chữ ký đang hiện: status visible, giữ `maxVisible` cái mới nhất, cũ trước. */
export function visibleSignatures(sigs, maxVisible) {
  const v = sigs.filter((s) => s.status === 'visible')
  return v.length > maxVisible ? v.slice(v.length - maxVisible) : v
}

function syncEntries(scene, visible, spotlightOn, now) {
  const ids = new Set()
  for (const sig of visible) {
    ids.add(sig.id)
    if (scene.entries.has(sig.id)) continue
    // Lần đồng bộ đầu (vừa mở màn show) = chữ ký có sẵn → hiện ngay, không diễn.
    const animate = scene.initialized
    scene.entries.set(sig.id, { id: sig.id, arrivedAt: now, animate, rect: null, floater: null })
    if (animate && spotlightOn) scene.queue.push(sig.id)
  }
  for (const id of scene.entries.keys()) {
    if (!ids.has(id)) scene.entries.delete(id)
  }
  scene.queue = spotlightOn ? scene.queue.filter((id) => ids.has(id)) : []
  if (scene.spot && (!ids.has(scene.spot.id) || !spotlightOn)) scene.spot = null
  scene.initialized = true
}

function advanceSpotlight(scene, effect, now) {
  if (scene.spot && now >= scene.spot.until) scene.spot = null
  if (!scene.spot && scene.queue.length) {
    const id = scene.queue.shift()
    scene.spot = { id, until: now + spotlightDuration(effect.spotlightMs, scene.queue.length) }
    // Hiệu ứng vào bắt đầu lúc tới lượt, không phải lúc gửi — nếu không, chữ ký
    // chờ trong hàng đã "diễn" xong trước khi kịp hiện ra.
    scene.entries.get(id).arrivedAt = now
    scene.entries.get(id).rect = null
  }
}

function spotlightBox(aspect, scale, W, H) {
  let h = scale * H
  let w = h * aspect
  if (w > W * 0.9) { w = W * 0.9; h = w / aspect }
  return { x: (W - w) / 2, y: (H - h) / 2, w, h }
}

function smoothTo(entry, target, k) {
  if (!entry.rect) { entry.rect = { ...target }; return }
  const r = entry.rect
  r.x += (target.x - r.x) * k
  r.y += (target.y - r.y) * k
  r.w += (target.w - r.w) * k
  r.h += (target.h - r.h) * k
}

/**
 * @param {object} scene  từ createScene (bị mutate)
 * @param {object} p
 * @param {Array}  p.sigs      mọi chữ ký, cũ → mới
 * @param {object} p.config    config sự kiện
 * @param {number} p.W, p.H    kích thước vùng LED (px)
 * @param {number} p.now       ms
 * @param {(sig) => number} p.aspectOf  rộng/cao bố cục chữ ký
 * @returns {Array<{id, sig, x, y, w, h, alpha, drawProgress, spot}>}
 */
export function stepScene(scene, { sigs, config, W, H, now, aspectOf }) {
  const { layout, effect } = config
  const dt = scene.lastNow == null ? 0 : Math.min(MAX_DT, Math.max(0, (now - scene.lastNow) / 1000))
  scene.lastNow = now

  const visible = visibleSignatures(sigs, layout.maxVisible)
  syncEntries(scene, visible, effect.spotlight, now)
  advanceSpotlight(scene, effect, now)

  const waiting = new Set(scene.queue)
  const shown = visible.filter((s) => !waiting.has(s.id))
  const aspects = new Map(shown.map((s) => [s.id, Math.max(0.2, aspectOf(s) || 1)]))

  const targets = new Map()
  if (layout.mode === 'grid') {
    let sum = 0
    for (const a of aspects.values()) sum += a
    const avg = shown.length ? sum / shown.length : 1
    const { slots } = gridLayout(shown.length, W, H, avg, layout.gap * H, layout.padding * H)
    shown.forEach((s, i) => targets.set(s.id, slots[i]))
  } else {
    const h = layout.floatSize * H
    const speed = layout.floatSpeed * H
    for (const s of shown) {
      const entry = scene.entries.get(s.id)
      const w = h * aspects.get(s.id)
      entry.floater ??= createFloater(s.id, W, H, w, h)
      stepFloater(entry.floater, dt, speed, W, H, w, h)
      const bob = Math.sin(now / 1000 * Math.PI * 0.5 + entry.floater.phase) * P.FLOAT_BOB * h
      targets.set(s.id, { x: entry.floater.x, y: entry.floater.y + bob, w, h })
    }
  }
  if (scene.spot && targets.has(scene.spot.id)) {
    targets.set(scene.spot.id, spotlightBox(aspects.get(scene.spot.id), effect.spotlightScale, W, H))
  }

  const k = 1 - Math.exp(-dt * P.POSITION_SMOOTHING)
  const backdropTarget = scene.spot ? P.SPOTLIGHT_BACKDROP_ALPHA : 1
  scene.backdrop += (backdropTarget - scene.backdrop) * k
  if (Math.abs(backdropTarget - scene.backdrop) < 0.002) scene.backdrop = backdropTarget
  const items = []
  let spotItem = null
  for (const s of shown) {
    const entry = scene.entries.get(s.id)
    const target = targets.get(s.id)
    if (!target) continue
    smoothTo(entry, target, k)

    const st = entry.animate ? entranceState(effect.entrance, (now - entry.arrivedAt) / effect.entranceMs) : SETTLED
    if (st === SETTLED) entry.animate = false
    const r = entry.rect
    const cw = r.w * st.scale, ch = r.h * st.scale
    const item = {
      id: s.id,
      sig: s,
      x: r.x + (r.w - cw) / 2,
      y: r.y + (r.h - ch) / 2 + st.dy * r.h,
      w: cw,
      h: ch,
      alpha: st.alpha,
      drawProgress: st.drawProgress,
      spot: scene.spot?.id === s.id,
    }
    if (!item.spot) item.alpha *= scene.backdrop
    if (item.spot) spotItem = item
    else items.push(item)
  }
  if (spotItem) items.push(spotItem) // vẽ sau cùng = nằm trên
  return items
}
