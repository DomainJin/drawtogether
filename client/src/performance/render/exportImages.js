/** Lưu ảnh: PNG từng chữ ký, ZIP tất cả, chụp màn show — SPEC §7. */
import { PERF_CONFIG as P } from '../config.js'
import { buildZip, safeFileName } from '../zipStore.js'
import { fitRect, qrPlacement } from '../stageGeometry.js'
import { renderSignatureCanvas } from './drawSignature.js'

export const styleOf = (config) => ({ ink: config.ink, name: config.name })

function canvasToBlob(canvas, type = 'image/png') {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không tạo được ảnh'))), type)
  })
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const stamp = (ms) => {
  const d = new Date(ms)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function signatureFileName(sig, index) {
  const n = String(index + 1).padStart(4, '0')
  return `${n}-${safeFileName(sig.name)}-${stamp(sig.createdAt)}.png`
}

export async function signaturePng(sig, config) {
  return canvasToBlob(renderSignatureCanvas(sig, styleOf(config), P.EXPORT_HEIGHT_PX))
}

/** ZIP mọi chữ ký. Vẽ tuần tự, nhường luồng giữa các ảnh để UI không đơ.
 *  @param {(done, total) => void} onProgress */
export async function signaturesZip(sigs, config, onProgress) {
  const files = []
  for (let i = 0; i < sigs.length; i++) {
    const blob = await signaturePng(sigs[i], config)
    files.push({ name: signatureFileName(sigs[i], i), data: new Uint8Array(await blob.arrayBuffer()) })
    onProgress?.(i + 1, sigs.length)
    await new Promise((r) => setTimeout(r, 0))
  }
  return new Blob([buildZip(files)], { type: 'application/zip' })
}

/** Nền vùng LED: màu → ảnh/frame video (theo object-fit) → lớp tối. Canvas
 *  không có object-fit nên tự tính giống hệt CSS — ảnh chụp/clip khớp màn hình. */
export function drawStageBackground(ctx, config, bgEl, W, H) {
  const bg = config.showBg
  ctx.fillStyle = bg.color
  ctx.fillRect(0, 0, W, H)
  if (bgEl && bg.type !== 'color') {
    const sw = bgEl.videoWidth || bgEl.naturalWidth
    const sh = bgEl.videoHeight || bgEl.naturalHeight
    if (sw && sh) {
      const r = fitRect(sw, sh, W, H, bg.fit)
      ctx.drawImage(bgEl, r.x, r.y, r.w, r.h)
    }
  }
  if (bg.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${bg.dim})`
    ctx.fillRect(0, 0, W, H)
  }
}

/** QR + chú thích, cùng vị trí với lớp QR (DOM) trên màn show. */
export function drawStageQr(ctx, config, qrImg, W, H) {
  if (!qrImg || !config.qr.show || !qrImg.naturalWidth) return
  const q = qrPlacement(W, H, config.qr)
  ctx.drawImage(qrImg, q.x, q.y, q.size, q.size)
  if (q.captionH) {
    ctx.fillStyle = '#ffffff'
    ctx.font = `600 ${Math.round(q.captionH * 0.62)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(config.qr.caption, q.x + q.size / 2, q.y + q.size + q.captionH / 2)
  }
}

/** Ảnh chụp màn show đúng kích thước vùng LED: nền → chữ ký → QR.
 *  `drawScene(ctx)` vẽ lại chữ ký ở độ phân giải thật (canvas preview trong
 *  setup đã bị thu nhỏ — chụp nó sẽ mờ). `bgEl` là <img>/<video> đang hiển thị
 *  (cần crossOrigin="anonymous", nếu không canvas bị "tainted" và toBlob ném lỗi). */
export async function stageSnapshot({ config, drawScene, bgEl, qrImg }) {
  const { w: W, h: H } = config.output
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  drawStageBackground(ctx, config, bgEl, W, H)
  drawScene?.(ctx)
  drawStageQr(ctx, config, qrImg, W, H)
  return canvasToBlob(c)
}

export { stamp as fileStamp }
