/** Stroke loại ảnh: một ảnh người dùng upload lên bảng để vẽ đè.
 *
 *  Ảnh đi chung đường với nét vẽ (draw:stroke → bảng strokes) thay vì một kênh
 *  riêng, để thứ tự lớp tự đúng: ảnh chèn trước thì các nét sau nằm trên nó,
 *  cả khi xem trực tiếp lẫn khi người mới vào phòng dựng lại lịch sử. Undo và
 *  Xoá bảng cũng áp dụng cho ảnh mà không phải viết thêm gì.
 *
 *  Server là chốt chặn cuối: client đã tự nén ảnh, nhưng không được tin điều
 *  đó — một data URL 50MB lọt vào Postgres là mỗi lần có người vào phòng đều
 *  phải kéo nó về. */

/** Trần độ dài data URL (ký tự). Client nén ảnh xuống dưới ngân sách của nó
 *  (IMAGE_CONFIG.MAX_ENCODED_CHARS), còn đây là trần cứng phía server — phải
 *  LỚN HƠN ngân sách client, test image-upload.test.mjs kiểm điều đó. */
export const IMAGE_STROKE_MAX_SRC_CHARS = 1_200_000

/** Gói socket.io mặc định chặn ở 1MB, nhỏ hơn trần ảnh ở trên — vượt ngưỡng
 *  là server đóng thẳng kết nối, client chỉ thấy "transport close". Chừa thêm
 *  phần cho các trường khác của stroke và khung gói. */
export const SOCKET_MAX_HTTP_BUFFER_BYTES = IMAGE_STROKE_MAX_SRC_CHARS + 256 * 1024

/** Kích thước bảng vẽ (CANVAS_SIZE phía client). Ảnh đặt ngoài vùng này thì
 *  không ai nhìn thấy nhưng vẫn tốn chỗ lưu. */
export const BOARD_SIZE_PX = 4000

const SRC_PREFIX = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/

export function isImageStroke(stroke) {
  return stroke?.tool === 'image'
}

/** Trả null nếu hợp lệ, hoặc chuỗi lý do bị từ chối (để log). */
export function validateImageStroke(stroke) {
  const { src, points } = stroke || {}
  if (typeof src !== 'string') return 'thiếu src'
  if (src.length > IMAGE_STROKE_MAX_SRC_CHARS) return `ảnh quá lớn (${src.length} ký tự)`
  // Chỉ nhận data URL raster. SVG bị loại cố ý: SVG mang được script, còn URL
  // http thì biến server thành chỗ lưu link tới ảnh của bên thứ ba.
  if (!SRC_PREFIX.test(src)) return 'src không phải data URL png/jpeg/webp'

  if (!Array.isArray(points) || points.length !== 2) return 'points phải là 2 góc'
  const [a, b] = points
  const nums = [a?.x, a?.y, b?.x, b?.y]
  if (!nums.every(Number.isFinite)) return 'toạ độ không hợp lệ'
  if (b.x <= a.x || b.y <= a.y) return 'khung ảnh rỗng hoặc ngược'
  if (b.x < 0 || b.y < 0 || a.x > BOARD_SIZE_PX || a.y > BOARD_SIZE_PX) return 'ảnh nằm ngoài bảng vẽ'
  return null
}
