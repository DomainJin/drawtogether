import { useCallback, useEffect, useRef } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { createScene, stepScene } from '../../../performance/scene.js'
import { fitLayout } from '../../../performance/signatureLayout.js'
import { createSpriteCache } from '../../../performance/render/spriteCache.js'
import { drawSignature } from '../../../performance/render/drawSignature.js'
import { styleOf } from '../../../performance/render/exportImages.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'

const PRUNE_EVERY_FRAMES = 120

/** Vòng render requestAnimationFrame của màn show / preview.
 *
 *  Đọc store bằng getState() mỗi frame — React không re-render theo frame.
 *  `pxScaleRef`: độ phân giải canvas so với vùng LED (preview nhỏ → < 1).
 *  `fontVersion` tăng khi font web tải xong → vẽ lại mọi sprite.
 *  @returns {{drawFull(ctx)}} vẽ lại cảnh hiện tại ở độ phân giải thật (chụp ảnh) */
export function useStageRenderer(canvasRef, pxScaleRef, fontVersion) {
  const itemsRef = useRef([])
  const fontVersionRef = useRef(fontVersion)
  fontVersionRef.current = fontVersion
  const cacheRef = useRef(null)

  useEffect(() => {
    const scene = createScene()
    const cache = createSpriteCache()
    cacheRef.current = cache
    let raf = 0
    let frameNo = 0

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const canvas = canvasRef.current
      const { config, signatures } = usePerformanceStore.getState()
      if (!canvas || !config) return

      const { w: W, h: H } = config.output
      const px = pxScaleRef.current
      const cw = Math.max(1, Math.round(W * px)), ch = Math.max(1, Math.round(H * px))
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw
        canvas.height = ch
      }

      const style = styleOf(config)
      cache.setStyle(style, JSON.stringify(style) + '|' + fontVersionRef.current)
      const items = stepScene(scene, { sigs: signatures, config, W, H, now, aspectOf: (s) => cache.aspect(s) })
      itemsRef.current = items

      const ctx = canvas.getContext('2d')
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, cw, ch)
      ctx.setTransform(px, 0, 0, px, 0, 0)

      const budget = { left: P.SPRITE_RENDER_PER_FRAME }
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

      if (++frameNo % PRUNE_EVERY_FRAMES === 0) cache.prune(new Set(signatures.map((s) => s.id)))
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      cache.clear()
      cacheRef.current = null
    }
  }, [canvasRef, pxScaleRef])

  const drawFull = useCallback((ctx) => {
    const { config } = usePerformanceStore.getState()
    const cache = cacheRef.current
    if (!config || !cache) return
    const style = styleOf(config)
    for (const it of itemsRef.current) {
      ctx.globalAlpha = it.alpha
      drawSignature(ctx, it.sig, style, it, it.drawProgress, cache.layout(it.sig))
    }
    ctx.globalAlpha = 1
  }, [])

  return { drawFull }
}
