/** Phần trình duyệt của upload ảnh: giải mã file và nén thành data URL.
 *  Thuật toán dò nấc nén nằm ở imagePlacement.js (thuần, có test); file này
 *  chỉ cung cấp canvas để thuật toán đó gọi. */
import { IMAGE_CONFIG as CFG } from './config.js'
import { encodeWithinBudget } from './imagePlacement.js'

/** Nạp ảnh từ URL, có timeout — ảnh hỏng đôi khi không bắn onerror mà treo
 *  im lặng, và người dùng đứng nhìn "Đang xử lý ảnh..." mãi. */
export function loadImageElement(url, timeoutMs = CFG.DECODE_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const timer = setTimeout(() => {
      img.onload = img.onerror = null
      reject(new Error('Giải mã ảnh quá lâu'))
    }, timeoutMs)
    img.onload = () => { clearTimeout(timer); resolve(img) }
    img.onerror = () => { clearTimeout(timer); reject(new Error('Không đọc được ảnh')) }
    img.src = url
  })
}

/** File → ảnh đã nén { src, w, h, quality }. Ném lỗi có câu báo cho người dùng. */
export async function encodeImageFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImageElement(url)
    const srcW = img.naturalWidth
    const srcH = img.naturalHeight
    if (!srcW || !srcH) throw new Error('Ảnh rỗng')

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const encode = (w, h, quality) => {
      canvas.width = w
      canvas.height = h
      // Lót trắng: JPEG không có kênh alpha, vùng trong suốt của PNG sẽ thành
      // đen nếu không lót — trong khi bảng vẽ nền trắng.
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      return canvas.toDataURL(CFG.OUTPUT_TYPE, quality)
    }

    const out = encodeWithinBudget(encode, srcW, srcH)
    if (!out) throw new Error('Ảnh quá chi tiết, nén tới mức nhỏ nhất vẫn vượt dung lượng cho phép')
    return out
  } finally {
    URL.revokeObjectURL(url)
  }
}
