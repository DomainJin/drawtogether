/** Màn nước thực tế: bề ngang 8 m, van cách nhau 50 mm → 20 van/m → 160 van.
 *
 *  Số lấy từ panel Physical config của Waterfall Designer (app đang chạy giàn
 *  thật), khớp với VALVES_PER_METER = 20 trong waterfall-sprite/core/physical.
 *
 *  Suy DEFAULT_VALVE_COUNT ra từ hai số vật lý này thay vì gõ thẳng 160: đổi
 *  chiều dài màn chỉ phải sửa một chỗ. Trước đây mặc định là 80 (màn 2 m), nên
 *  khi app chưa nhận được status từ bridge nó khai báo 80 van và gửi frame 10
 *  byte cho thiết bị 160 van — hoạ tiết bị lặp thành hai nửa giống nhau.
 *
 *  Đây chỉ là giá trị KHỞI ĐẦU. Khi bridge báo valve_count thật từ thiết bị,
 *  số đó thắng (applyBridgeStatus → resizeCols). */
const CURTAIN_WIDTH_M = 8
const VALVES_PER_METER = 20

export const WATERFALL_CONFIG = {
  DEFAULT_WS_PORT: 3333,
  DEFAULT_HTTP_PORT: 8080,
  CURTAIN_WIDTH_M,
  VALVES_PER_METER,
  DEFAULT_VALVE_COUNT: Math.round(CURTAIN_WIDTH_M * VALVES_PER_METER),
  /** Số hàng = độ DÀI hoạ tiết, không phải độ mịn (độ mịn do nhịp rơi quyết
   *  định). Cũng chính là chiều cao vùng vẽ: canvas khoá theo tỉ lệ thật, nên
   *  muốn vẽ dài hơn thì thêm hàng chứ không kéo giãn canvas — kéo giãn là hoạ
   *  tiết ra màn nước bị méo.
   *
   *  256 hàng ở nhịp 16ms = 4,1 giây, cao 28,8m nước rơi, vùng vẽ cao khoảng
   *  2 màn hình điện thoại. Trần 512 hàng = 8,2 giây. */
  DEFAULT_ROW_COUNT: 256,
  MIN_ROW_COUNT: 2,
  MAX_ROW_COUNT: 512,
  /** Nhịp thời gian giữa hai hàng — quyết định ĐỘ PHÂN GIẢI DỌC của hoạ tiết.
   *
   *  Van cách nhau cố định 25mm theo chiều ngang, còn khoảng cách dọc bằng
   *  quãng nước rơi trong một nhịp. Ở 80ms mỗi hàng cách nhau 286mm — cao gấp
   *  11,4 lần bề ngang, nên nét chéo hiện thành bậc thang rõ mồn một. Ở 16ms
   *  còn 51mm, tức 2,1 lần: gần mượt.
   *
   *  16ms lấy theo DEFAULT_ROW_INTERVAL_MS của waterfall-sprite. Hạ nữa thì
   *  càng vuông (10ms ~ 1,3 lần) nhưng phải xem ESP32/SPI có kịp không. */
  DEFAULT_ROW_INTERVAL_MS: 16,
  MIN_ROW_INTERVAL_MS: 10,
  MAX_ROW_INTERVAL_MS: 300,
  MAX_VALVES: 512,

  /** Chiều cao màn nước (m) — quãng nước rơi từ vòi tới đáy.
   *
   *  Quyết định thời gian rơi, và qua đó quyết định mỗi nhịp hàng ứng với bao
   *  nhiêu mm ngoài đời. Xem geometry.js. Lấy từ panel Physical config của
   *  Waterfall Designer; app tự tính ra fall_time 1428ms / visible_rows 89 ở
   *  nhịp 16ms, dùng để đối chiếu. */
  CURTAIN_HEIGHT_M: 10.0,
  GRAVITY_M_S2: 9.81,

  /** Gửi hàng DƯỚI CÙNG của canvas trước.
   *
   *  Màn nước là máy in dòng dựng đứng: hàng gửi trước rơi xa nhất nên nằm dưới
   *  cùng, hàng gửi sau cùng đang ở ngay dưới vòi ("newest at top, oldest near
   *  the bottom" — waterfall-sprite/core/physical/types.ts). Canvas thì hàng 0
   *  ở trên. Gửi xuôi từ hàng 0 là hoạ tiết lộn ngược theo chiều dọc.
   *
   *  Để thành cờ chứ không nhét cứng: nếu firmware của bạn đã tự đảo rồi thì
   *  chỉ cần đặt false, không phải sửa code. */
  EMIT_BOTTOM_ROW_FIRST: true,

  /** Bỏ các hàng TRỐNG ở đầu và cuối hoạ tiết.
   *
   *  Hàng trống vẫn chiếm đủ thời gian của nó: vẽ ở nửa trên canvas 256 hàng
   *  thì toàn bộ vùng trống phía dưới được gửi trước, bấm Gửi xong phải chờ
   *  hơn 3 giây mới thấy nước. Cắt đi rồi dịch mốc thời gian về 0 thì hoạ
   *  tiết chạy ngay, mà nội dung và nhịp bên trong không đổi một chút nào.
   *
   *  Đặt false nếu bạn muốn giữ đúng khoảng lặng đã vẽ. */
  TRIM_EMPTY_ROWS: true,

  /** Bề dày nét vẽ — đường kính tính bằng pixel trên màn, giống dải width của
   *  Toolbar whiteboard. Để theo pixel chứ không theo số ô vì ô lưới rất hẹp
   *  và cao (160 cột × 24-64 hàng): nét phải tròn theo mắt nhìn thì mới dễ vẽ.
   *  brush.js quy đổi ra bán kính số ô riêng cho từng trục. */
  BRUSH_SIZES_PX: [4, 10, 20, 34],
  DEFAULT_BRUSH_PX: 10,

  /** Hiển thị preview — xem gridRenderer.js.
   *
   *  ROW_OVERLAP: chiều cao thanh vẽ tính theo bội số của một hàng. >1 để các
   *  hàng chồng lên nhau, nét xiên thành dải liền thay vì bậc thang. 1.0 = sát
   *  nhau (còn thấy khuyết ở mối nối), 2.0 = rất mượt nhưng nét dày lên theo
   *  trục thời gian. Chỉ nở theo trục HÀNG; trục cột (van) giữ chính xác.
   *
   *  CORNER_ROUND: độ bo góc theo cạnh ngắn. 0 = vuông, 0.5 = bo tròn hết cỡ. */
  PREVIEW_ROW_OVERLAP: 1.15,
  PREVIEW_CORNER_ROUND: 0.5,
  /** Hai dải ở hai hàng kề nhau cách nhau tối đa bấy nhiêu cột thì vẫn coi là
   *  cùng một nét và được nối lại. 0 = phải chồng lấn mới nối. Để lớn quá thì
   *  hai nét nằm cạnh nhau bị dính làm một. */
  PREVIEW_CONNECT_GAP_CELLS: 1,
  /** Số frame tối đa nhét trong MỘT gói socket.io.
   *
   *  Mỗi Uint8Array là một "binary attachment", và socket.io-parser mặc định
   *  chặn ở maxAttachments = 10: vượt ngưỡng thì parser phía server ném
   *  "too many attachments" và ĐÓNG LUÔN kết nối — client chỉ thấy
   *  "transport close" chứ không nhận được lỗi nào. Để 8 cho có biên an toàn. */
  MAX_FRAMES_PER_PACKET: 8,
}

/** Kích thước layout của khu vực Màn nước.
 *
 *  Để ở đây vì cả WaterfallPanel (tự vẽ mình) lẫn WhiteboardPage (chừa chỗ cho
 *  canvas) đều phải dùng chung một bộ số — trước đây page hardcode `right: 312`
 *  còn panel hardcode `width: 280`, đổi một bên là lệch ngay. */
export const WATERFALL_UI = {
  /** Dưới ngưỡng này panel thành bottom sheet, canvas chiếm trọn bề ngang. */
  MOBILE_BREAKPOINT_PX: 768,
  /** Bề rộng panel cột phải trên desktop. */
  PANEL_WIDTH_PX: 280,
  /** Lề phải + khoảng hở giữa panel và canvas. */
  PANEL_GAP_PX: 32,
  /** Chiều cao phần sheet luôn nhìn thấy khi thu gọn trên mobile. */
  SHEET_COLLAPSED_PX: 148,
  /** Bề rộng thẻ điều khiển nổi khi thu gọn trên desktop. */
  COMPACT_CARD_PX: 320,
}
