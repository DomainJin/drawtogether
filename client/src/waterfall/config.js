/** Màn nước thực tế: bề ngang 4 m, van cách nhau 25 mm → 40 van/m → 160 van.
 *
 *  Suy DEFAULT_VALVE_COUNT ra từ hai số vật lý này thay vì gõ thẳng 160: đổi
 *  chiều dài màn chỉ phải sửa một chỗ. Trước đây mặc định là 80 (màn 2 m), nên
 *  khi app chưa nhận được status từ bridge nó khai báo 80 van và gửi frame 10
 *  byte cho thiết bị 160 van — hoạ tiết bị lặp thành hai nửa giống nhau.
 *
 *  Đây chỉ là giá trị KHỞI ĐẦU. Khi bridge báo valve_count thật từ thiết bị,
 *  số đó thắng (applyBridgeStatus → resizeCols). */
const CURTAIN_WIDTH_M = 4
const VALVES_PER_METER = 40

export const WATERFALL_CONFIG = {
  DEFAULT_WS_PORT: 3333,
  DEFAULT_HTTP_PORT: 8080,
  CURTAIN_WIDTH_M,
  VALVES_PER_METER,
  DEFAULT_VALVE_COUNT: Math.round(CURTAIN_WIDTH_M * VALVES_PER_METER),
  DEFAULT_ROW_COUNT: 24,
  MIN_ROW_COUNT: 2,
  MAX_ROW_COUNT: 64,
  DEFAULT_ROW_INTERVAL_MS: 80,
  MIN_ROW_INTERVAL_MS: 10,
  MAX_ROW_INTERVAL_MS: 300,
  MAX_VALVES: 512,
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
