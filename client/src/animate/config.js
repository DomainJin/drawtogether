/** Tham số của tính năng Animate — mọi con số của sprite/nút bấm nằm ở đây.
 *
 *  Trước đây kích thước sprite, ngưỡng nền trắng và toạ độ nút được gõ thẳng
 *  trong AnimateOverlay. Đổi một con số phải mò khắp file, và hai nút (Animate,
 *  Xoá) tự xếp chỗ bằng tay nên thêm nút thứ ba là chồng lên nhau. Giờ vị trí
 *  suy ra từ bề rộng + khoảng cách khai báo ở đây. */

/** Nền canvas whiteboard là trắng đục — vùng cắt ra luôn kèm một mảng trắng
 *  bao quanh nét vẽ. Không bóc nền thì sprite raw bay lượn dưới dạng một ô chữ
 *  nhật trắng, che mất hình phía dưới. Hai ngưỡng dựng một dốc alpha để mép nét
 *  (pixel xám do khử răng cưa) mờ dần thay vì cắt cụt thành bậc thang. */
const INK_LUMA = 200   // tối hơn mức này → mực đặc, giữ nguyên
const BG_LUMA = 245    // sáng hơn mức này → nền, bỏ hẳn

export const ANIMATE_CONFIG = {
  INK_LUMA,
  BG_LUMA,
  /** Chừa vài pixel quanh nét sau khi cắt sát mực: cắt sát quá thì nét ngoài
   *  cùng dính mép ảnh, lúc xoay sprite bị xén. */
  TRIM_PADDING_PX: 2,
  /** Vùng chọn hầu như trắng (< 0.2% pixel có mực) coi như chọn hụt — không
   *  đáng tạo sprite, và cũng không nên xoá vùng đó khỏi canvas. */
  MIN_INK_RATIO: 0.002,
  /** Cạnh dài nhất của ảnh texture gửi qua socket. Raw sprite đi kèm PNG
   *  base64; server giữ 50 sprite mỗi phòng trong Redis nên texture phải nhỏ.
   *  256px đủ nét cho một hình vẽ tay hiển thị cỡ vài trăm pixel. */
  MAX_TEXTURE_PX: 256,
  /** Sprite nhỏ hơn mức này thì phóng to cho dễ thấy; lớn hơn phần này của
   *  màn hình thì thu lại — vùng chọn rộng lúc zoom sâu từng tạo ra sprite
   *  to hơn cả khung nhìn. */
  MIN_SPRITE_PX: 80,
  MAX_SPRITE_VIEWPORT_RATIO: 0.45,
  /** Vùng chọn nhỏ hơn mức này bỏ qua (chạm nhầm, không phải kéo chọn). */
  MIN_SELECTION_PX: 20,
  MIN_CROP_PX: 10,
  /** Không có nhãn AI thì không biết nó là cá hay xe — chỉ cho bay lượn. */
  RAW_BEHAVIORS: ['fly', 'float', 'roam'],
  /** Khoá localStorage nhớ lựa chọn bật/tắt AI giữa các phiên. */
  AI_RENDER_STORAGE_KEY: 'wb_animate_ai_render',
}

/** Bố cục cụm nút góc dưới trái. Vị trí từng nút suy từ bề rộng + GAP, đừng
 *  gõ toạ độ tuyệt đối vào component nữa. */
const BTN_H = 34
const GAP = 8
const LEFT = 58
const BOTTOM = 90
const ANIMATE_W = 118
const AI_TOGGLE_W = 92

export const ANIMATE_UI = {
  BTN_HEIGHT_PX: BTN_H,
  GAP_PX: GAP,
  BOTTOM_PX: BOTTOM,
  ANIMATE_LEFT_PX: LEFT,
  ANIMATE_WIDTH_PX: ANIMATE_W,
  AI_TOGGLE_LEFT_PX: LEFT + ANIMATE_W + GAP,
  AI_TOGGLE_WIDTH_PX: AI_TOGGLE_W,
  CLEAR_LEFT_PX: LEFT + ANIMATE_W + GAP + AI_TOGGLE_W + GAP,
  Z_SPRITE_LAYER: 50,
  Z_SELECTION: 250,
  Z_BUTTONS: 300,
  Z_TOAST: 400,
}
