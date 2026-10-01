/** Vẽ một frame cảnh — dùng chung cho màn show trực tiếp và clip dựng lại,
 *  để clip ra đúng như những gì khán giả đã thấy. */
import { PERF_CONFIG as P } from '../config.js'
import { fitLayout } from '../signatureLayout.js'
import { drawSignature } from './drawSignature.js'

/** Vẽ các item của stepScene ở hệ toạ độ vùng LED (ctx đã scale theo `px`).
 *  `budget.left` = số sprite còn được vẽ mới trong frame này. */
export function drawSceneItems(ctx, items, cache, style, px, budget) {
  for (const it of items) {
    if (it.alpha <= 0 || it.w <= 0 || it.h <= 0) continue
    ctx.globalAlpha = it.alpha
    const layout = cache.layout(it.sig)
    const needPx = it.h * px
    // Đang "viết" hoặc to hơn trần sprite (spotlight) → vẽ trực tiếp.
    if (it.drawProgress < 1 || needPx > P.SPRITE_MAX_PX) {
      drawSignature(ctx, it.sig, style, it, it.drawProgress, layout)
      continue
    }
    const sprite = cache.get(it.sig, needPx, budget)
    if (!sprite) continue
    const f = fitLayout(layout, it)
    ctx.drawImage(sprite, f.x, f.y, layout.w * f.scale, layout.h * f.scale)
  }
  ctx.globalAlpha = 1
}
