import { create } from 'zustand'

export const WATERFALL_CONFIG = {
  DEFAULT_WS_PORT: 3333,
  DEFAULT_HTTP_PORT: 8080,
  DEFAULT_VALVE_COUNT: 80,
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
