/** Biến vùng canvas vừa cắt thành texture cho sprite raw.
 *
 *  Canvas whiteboard được tô trắng đục (WhiteboardCanvas fillRect '#ffffff'),
 *  nên getImageData trả về một khối trắng có vài nét đen. Ném thẳng khối đó lên
 *  lớp animation thì thứ bay lượn là một tấm thẻ trắng, không phải hình vẽ.
 *
 *  Hai bước, cả hai đều thuần (không đụng DOM) để test được bằng số:
 *   1. Bóc nền: trắng → alpha 0, mực → giữ nguyên, xám ở giữa → alpha theo dốc
 *      tuyến tính (giữ mép nét mượt).
 *   2. Cắt sát mực: người dùng kéo khung rộng hơn hình; giữ nguyên lề trắng thì
 *      sprite "va tường" bằng khoảng không và trông như lơ lửng cách mép.
 */
import { ANIMATE_CONFIG as CFG } from './config.js'

/** Độ sáng cảm nhận, đã chồng lên nền trắng — pixel trong suốt phải ra 255
 *  (nền) chứ không phải 0 (đen), nếu không vùng rỗng bị coi là mực đặc. */
export function lumaOverWhite(r, g, b, a = 255) {
  const l = 0.299 * r + 0.587 * g + 0.114 * b
  const t = a / 255
  return l * t + 255 * (1 - t)
}

/** Dốc alpha giữa hai ngưỡng: <= INK_LUMA đặc, >= BG_LUMA trong suốt. */
export function alphaForLuma(l, inkLuma = CFG.INK_LUMA, bgLuma = CFG.BG_LUMA) {
  if (l <= inkLuma) return 255
  if (l >= bgLuma) return 0
  return Math.round(255 * (bgLuma - l) / (bgLuma - inkLuma))
}

/** Bóc nền trắng khỏi một ImageData-like. Trả bản sao, không sửa đầu vào. */
export function stripBackground({ data, width, height }, opts = {}) {
  const inkLuma = opts.inkLuma ?? CFG.INK_LUMA
  const bgLuma = opts.bgLuma ?? CFG.BG_LUMA
  const out = new Uint8ClampedArray(data.length)
  let inkPixels = 0
  for (let i = 0; i < data.length; i += 4) {
    const l = lumaOverWhite(data[i], data[i + 1], data[i + 2], data[i + 3])
    const a = alphaForLuma(l, inkLuma, bgLuma)
    out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]
    // Alpha gốc vẫn có tiếng nói: nét vẽ mờ (opacity < 1) không được đặc lên.
    out[i + 3] = Math.round(a * (data[i + 3] / 255))
    if (out[i + 3] > 0) inkPixels++
  }
  return { data: out, width, height, inkPixels }
}

/** Hộp bao quanh mọi pixel còn alpha, nới thêm `padding`. null nếu rỗng hẳn. */
export function inkBounds({ data, width, height }, padding = 0) {
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] === 0) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return null
  const x = Math.max(0, minX - padding)
  const y = Math.max(0, minY - padding)
  return {
    x, y,
    w: Math.min(width, maxX + 1 + padding) - x,
    h: Math.min(height, maxY + 1 + padding) - y,
  }
}

/** Cắt một hình chữ nhật ra khỏi ImageData-like. */
export function cropPixels({ data, width }, box) {
  const out = new Uint8ClampedArray(box.w * box.h * 4)
  for (let y = 0; y < box.h; y++) {
    const src = ((box.y + y) * width + box.x) * 4
    out.set(data.subarray(src, src + box.w * 4), y * box.w * 4)
  }
  return { data: out, width: box.w, height: box.h }
}

/** Bóc nền + cắt sát mực trong một lượt.
 *  Trả null khi vùng chọn gần như trắng trơn — gọi bên ngoài hiểu là "chọn
 *  hụt", đừng tạo sprite và đừng xoá vùng đó khỏi canvas. */
export function extractRawTexture(imageLike, opts = {}) {
  const padding = opts.padding ?? CFG.TRIM_PADDING_PX
  const minInkRatio = opts.minInkRatio ?? CFG.MIN_INK_RATIO
  const stripped = stripBackground(imageLike, opts)
  const total = stripped.width * stripped.height
  const inkRatio = total > 0 ? stripped.inkPixels / total : 0
  if (inkRatio < minInkRatio) return null
  const box = inkBounds(stripped, padding)
  if (!box) return null
  const cropped = cropPixels(stripped, box)
  return { ...cropped, inkRatio, box }
}

/** Hệ số thu nhỏ texture để cạnh dài nhất không vượt `maxPx`. Không bao giờ
 *  phóng to: phóng to ảnh bitmap chỉ làm nặng payload chứ không nét thêm. */
export function textureScale(width, height, maxPx = CFG.MAX_TEXTURE_PX) {
  const longest = Math.max(width, height)
  return longest <= maxPx ? 1 : maxPx / longest
}
