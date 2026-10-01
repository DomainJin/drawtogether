/** Dựng lại clip màn show từ dữ liệu đã lưu — SPEC §8.
 *
 *  Render OFFLINE: mỗi frame dùng thời gian ảo t = frame/fps, vẽ xong mới mã
 *  hoá frame kế. Không quay màn hình nên không rớt frame dù máy chậm hay vùng
 *  LED 3072px; máy chậm thì chỉ dựng lâu hơn, clip vẫn mượt. */
import {
  BufferTarget, CanvasSource, Mp4OutputFormat, Output, WebMOutputFormat, getFirstEncodableVideoCodec,
  QUALITY_HIGH, QUALITY_MEDIUM, QUALITY_VERY_HIGH,
} from 'mediabunny'
import QRCode from 'qrcode'
import { CLIP_CONFIG as C } from '../config.js'
import { mediaUrl } from '../perfApi.js'
import { createScene, sceneIsSettled, stepScene } from '../scene.js'
import { estimateClipMs, evenFloor, replayEffect, replayOffsets } from '../replaySchedule.js'
import { createSpriteCache } from './spriteCache.js'
import { drawSceneItems } from './drawItems.js'
import { drawStageBackground, drawStageQr, styleOf } from './exportImages.js'

export class ClipError extends Error {}

const QUALITY = { medium: QUALITY_MEDIUM, high: QUALITY_HIGH, very_high: QUALITY_VERY_HIGH }

/** Nhường luồng cho UI vẽ tiến độ. MessageChannel chứ không setTimeout: tab bị
 *  ẩn thì setTimeout bị bóp còn 1 lần/giây (hoặc 1 lần/phút) — dựng clip sẽ
 *  gần như dừng hẳn khi người dùng chuyển tab. */
const yieldToUi = () => new Promise((resolve) => {
  const ch = new MessageChannel()
  ch.port1.onmessage = () => resolve()
  ch.port2.postMessage(0)
})

function withTimeout(promise, ms, message) {
  let timer
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new ClipError(message)), ms) }),
  ]).finally(() => clearTimeout(timer))
}

const once = (el, ok, fail = 'error') => new Promise((resolve, reject) => {
  const done = () => { el.removeEventListener(ok, done); el.removeEventListener(fail, bad); resolve() }
  const bad = () => { el.removeEventListener(ok, done); el.removeEventListener(fail, bad); reject(new ClipError('Không tải được nền')) }
  el.addEventListener(ok, done)
  el.addEventListener(fail, bad)
})

/** Nền ảnh/video riêng cho clip. Lỗi → null (clip dùng màu nền) + cảnh báo,
 *  không huỷ cả clip vì một file nền đã mất trên server. */
async function loadBackground(bg, onWarning) {
  if (bg.type === 'color' || !bg.url) return null
  const src = mediaUrl(bg.url)
  try {
    if (bg.type === 'image') {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = src
      await withTimeout(img.decode(), C.MEDIA_LOAD_TIMEOUT_MS, 'Tải ảnh nền quá lâu')
      return { el: img, video: false }
    }
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.preload = 'auto'
    video.playsInline = true
    const ready = once(video, 'loadeddata')
    video.src = src
    await withTimeout(ready, C.MEDIA_LOAD_TIMEOUT_MS, 'Tải video nền quá lâu')
    return { el: video, video: true }
  } catch {
    onWarning?.('Không tải được ảnh/video nền (có thể file đã mất trên server) — clip dùng màu nền.')
    return null
  }
}

async function seekVideo(video, tMs) {
  if (!video.duration || !Number.isFinite(video.duration)) return
  const target = (tMs / 1000) % video.duration
  if (Math.abs(video.currentTime - target) < 1e-3) return
  const seeked = once(video, 'seeked')
  video.currentTime = target
  await withTimeout(seeked, C.SEEK_TIMEOUT_MS, 'Tua video nền quá lâu')
}

async function loadQr(text) {
  const img = new Image()
  img.src = await QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: 512 })
  await img.decode()
  return img
}

/**
 * @param {object} p
 * @param {Array}  p.sigs     chữ ký cần phát lại, createdAt tăng dần
 * @param {object} p.config   config sự kiện (style, layout, hiệu ứng, nền, vùng LED)
 * @param {string} p.signUrl  link QR
 * @param {{mode:'even'|'real', spanMs:number, fps:number, quality:'medium'|'high'|'very_high', includeQr:boolean}} p.options
 * @param {(fraction:number) => void} [p.onProgress]
 * @param {(canvas) => void} [p.onPreview]
 * @param {(msg:string) => void} [p.onWarning]
 * @param {AbortSignal} [p.signal]
 * @returns {Promise<{blob: Blob, ext: string, codec: string, durationMs: number, width: number, height: number}>}
 */
export async function renderClip({ sigs, config, signUrl, options, onProgress, onPreview, onWarning, signal }) {
  if (!sigs.length) throw new ClipError('Chưa có chữ ký nào để dựng clip')
  if (typeof VideoEncoder === 'undefined') {
    throw new ClipError('Trình duyệt này không hỗ trợ dựng video — dùng Chrome hoặc Edge bản mới trên máy tính')
  }

  const W = evenFloor(config.output.w)
  const H = evenFloor(config.output.h)
  const { fps } = options
  const quality = QUALITY[options.quality] ?? QUALITY_HIGH
  const codec = await getFirstEncodableVideoCodec(C.CODECS, { width: W, height: H, quality, frameRate: fps })
  if (!codec) throw new ClipError(`Trình duyệt không mã hoá được video ${W}×${H}`)
  const format = codec === 'avc' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat()

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  const output = new Output({ format, target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec, bitrate: quality })
  output.addVideoTrack(source, { frameRate: fps })

  const bg = await loadBackground(config.showBg, onWarning)
  const qr = options.includeQr && config.qr.show ? await loadQr(signUrl) : null

  const offsets = replayOffsets(sigs.map((s) => s.createdAt), { mode: options.mode, spanMs: options.spanMs })
  const interval = sigs.length > 1 ? options.spanMs / (sigs.length - 1) : options.spanMs
  const cfg = { ...config, effect: replayEffect(config.effect, interval) }
  // Phát lại = mọi chữ ký được chọn đều hiện, bất kể giờ đang ẩn hay hiện.
  const timeline = sigs.map((s, i) => ({ ...s, status: 'visible', at: C.INTRO_MS + offsets[i] }))
  const lastAt = timeline[timeline.length - 1].at
  const estimateMs = estimateClipMs(options.spanMs, cfg.effect)

  const scene = createScene()
  const cache = createSpriteCache()
  const style = styleOf(cfg)
  cache.setStyle(style, 'clip')
  const live = []
  const frameMs = 1000 / fps
  let idleSince = null
  let t = 0

  await output.start()
  try {
    for (let frame = 0; ; frame++) {
      if (signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError')
      t = frame * frameMs
      while (live.length < timeline.length && timeline[live.length].at <= t) live.push(timeline[live.length])

      const items = stepScene(scene, { sigs: live, config: cfg, W, H, now: t, aspectOf: (s) => cache.aspect(s) })
      if (bg?.video) await seekVideo(bg.el, t)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      drawStageBackground(ctx, cfg, bg?.el, W, H)
      drawSceneItems(ctx, items, cache, style, 1, { left: Infinity })
      drawStageQr(ctx, cfg, qr, W, H)
      await source.add(t / 1000, frameMs / 1000)

      if (t >= lastAt && sceneIsSettled(scene)) {
        idleSince ??= t
        if (t - idleSince >= C.OUTRO_MS) break
      } else {
        idleSince = null
      }

      if (frame % C.PREVIEW_EVERY_FRAMES === 0) {
        onProgress?.(Math.min(0.99, t / estimateMs))
        onPreview?.(canvas)
        await yieldToUi()
      }
    }
    source.close()
    await output.finalize()
  } catch (err) {
    await output.cancel().catch(() => {})
    throw err
  } finally {
    if (bg?.video) bg.el.removeAttribute('src')
  }

  onProgress?.(1)
  return {
    blob: new Blob([output.target.buffer], { type: format.mimeType }),
    ext: format.fileExtension,
    codec,
    durationMs: t + frameMs,
    width: W,
    height: H,
  }
}
