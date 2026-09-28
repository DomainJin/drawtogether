/** Tham số của bảng vẽ chung (whiteboard).
 *
 *  CANVAS_SIZE trước đây gõ riêng trong WhiteboardPage và WhiteboardCanvas.
 *  Tính năng upload ảnh cần thêm con số đó lần thứ ba (để giữ ảnh trong bảng),
 *  và server cũng phải biết nó để từ chối ảnh đặt ngoài bảng — giờ gom về một
 *  chỗ; test image-upload.test.mjs đối chiếu với BOARD_SIZE_PX của server. */
export const WHITEBOARD_CONFIG = {
  CANVAS_SIZE: 4000,
  /** Port của server (Fastify + Socket.IO). Phải khớp PORT trong server/.env. */
  SERVER_PORT: 3001,
}

/** Upload ảnh để vẽ đè. Xem components/ImageUpload và whiteboard/imagePlacement.js. */
export const IMAGE_CONFIG = {
  /** Định dạng nhận vào. Đầu ra LUÔN là JPEG (xem OUTPUT_TYPE), nên đầu vào
   *  chỉ cần trình duyệt giải mã được. SVG bị loại: nó mang được script, và
   *  server cũng không nhận. */
  ACCEPT_TYPES: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'],

  /** Chặn file quá lớn TRƯỚC khi giải mã. Ảnh 25MB từ máy ảnh giải mã ra hàng
   *  trăm MB bitmap — điện thoại tắt tab trước khi kịp báo lỗi. */
  MAX_FILE_BYTES: 25 * 1024 * 1024,
  DECODE_TIMEOUT_MS: 15000,

  /** JPEG chứ không PNG: ảnh chụp nén PNG to gấp 5-10 lần. Mất trong suốt cũng
   *  không sao — bảng vẽ nền trắng đục, ảnh được lót trắng trước khi nén nên
   *  vùng trong suốt ra đúng màu nền. */
  OUTPUT_TYPE: 'image/jpeg',

  /** Cạnh dài nhất sau khi nén. Bảng 4000px, ảnh chiếm cỡ nửa khung nhìn — 1600
   *  là đủ nét khi zoom 100% mà không phình payload. */
  MAX_DIMENSION_PX: 1600,
  MIN_DIMENSION_PX: 256,

  /** Ngân sách độ dài data URL. Mọi người vào phòng đều phải tải lại từng ảnh
   *  trong lịch sử, nên giữ nhỏ; và PHẢI nhỏ hơn IMAGE_STROKE_MAX_SRC_CHARS
   *  của server (1.2M), nếu không server lặng lẽ bỏ ảnh. */
  MAX_ENCODED_CHARS: 900_000,

  /** Thứ tự thử: hạ chất lượng trước, hết nấc mới thu nhỏ kích thước. Ảnh chữ
   *  viết/sơ đồ chịu hạ chất lượng tốt hơn chịu thu nhỏ. */
  JPEG_QUALITIES: [0.9, 0.8, 0.7, 0.6, 0.5],
  DIMENSION_STEP: 0.8,

  /** Lúc mới chọn, ảnh chiếm bấy nhiêu phần khung nhìn hiện tại — đặt ngay chỗ
   *  người dùng đang nhìn, không phải góc (0,0) của bảng 4000px. */
  INITIAL_VIEW_RATIO: 0.6,
  /** Cạnh ngắn nhỏ nhất khi kéo thu nhỏ (px bảng vẽ). */
  MIN_PLACED_PX: 24,

  /** Tay nắm đổi cỡ đo bằng px MÀN HÌNH: khung ảnh nằm trong lớp bị scale theo
   *  zoom, zoom 29% mà để cỡ cố định thì tay nắm chỉ còn 5px, không chạm trúng. */
  HANDLE_SCREEN_PX: 20,
  OUTLINE_SCREEN_PX: 2,
  /** Ảnh xem trước hơi mờ để vẫn thấy nét vẽ bên dưới khi căn chỗ đặt. */
  PREVIEW_OPACITY: 0.85,
  ERROR_TOAST_MS: 5000,
}
