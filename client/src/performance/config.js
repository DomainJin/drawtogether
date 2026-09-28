/** Hằng số phía client của Performance mode.
 *
 *  Giới hạn của CONFIG sự kiện (min/max/options) KHÔNG nằm ở đây — server gửi
 *  schema cho trang setup (server/src/perf/configSchema.js). Ở đây chỉ là những
 *  gì server không cần biết: nhịp render, timeout, kích thước sprite. */
export const PERF_CONFIG = {
  /** Rộng/cao bảng ký. Cố định để mọi chữ ký có cùng hệ toạ độ — màn LED xếp
   *  chúng cạnh nhau, tỉ lệ lệch nhau thì chữ ký to nhỏ lộn xộn. */
  SIGN_PAD_ASPECT: 2,
  /** RDP epsilon theo cao bảng ký: 0.0015 ≈ 0.5px trên bảng 360px — mắt không
   *  thấy khác, số điểm giảm 3-6 lần. */
  SIMPLIFY_EPSILON: 0.0015,
  /** Phải ≤ SIGNATURE_LIMITS của server (MAX_POINTS 6000, MAX_STROKES 120). */
  MAX_POINTS: 6000,
  MAX_STROKES: 120,
  /** Khoảng cách tối thiểu giữa 2 điểm ghi nhận (theo cao bảng ký) — pointermove
   *  bắn 120Hz trên iPad, không lọc thì hết quota điểm giữa chừng chữ ký dài. */
  MIN_POINT_DIST: 0.002,

  SUBMIT_TIMEOUT_MS: 8000,
  SUBMIT_RETRIES: 3,
  JOIN_TIMEOUT_MS: 8000,
  ADMIN_ACK_TIMEOUT_MS: 8000,
  /** Kéo slider → gửi config sau khoảng lặng này (không gửi mỗi pixel kéo). */
  CONFIG_SEND_DEBOUNCE_MS: 150,

  /** Sprite chữ ký: cao px tối thiểu/tối đa. Tối đa chặn RAM — 500 chữ ký ×
   *  sprite 1000px là cả GB. Spotlight to hơn thì vẽ trực tiếp. */
  SPRITE_MIN_PX: 48,
  SPRITE_MAX_PX: 640,
  /** Vẽ lại sprite khi cần to hơn bản cache quá hệ số này (phóng to sẽ mờ)… */
  SPRITE_UPSCALE_TOLERANCE: 1.15,
  /** …hoặc nhỏ hơn quá hệ số này (giữ bản to phí RAM). */
  SPRITE_DOWNSCALE_TOLERANCE: 2.5,
  /** Pre-render tối đa bấy nhiêu sprite mỗi frame — mở show với 500 chữ ký có
   *  sẵn không làm đứng hình, chúng hiện dần trong ~1s. */
  SPRITE_RENDER_PER_FRAME: 6,

  /** Tốc độ làm mượt vị trí (1/giây): càng lớn càng bám đích nhanh. */
  POSITION_SMOOTHING: 4,
  SPOTLIGHT_MIN_MS: 1500,
  /** Độ đậm các chữ ký khác trong lúc spotlight — lùi lại cho chữ ký mới nổi bật. */
  SPOTLIGHT_BACKDROP_ALPHA: 0.35,
  /** Hàng đợi spotlight dài hơn ngưỡng này → mỗi cái còn một nửa thời gian. */
  SPOTLIGHT_BUSY_QUEUE: 3,
  /** Biên độ nhấp nhô khi trôi — theo cao chữ ký. */
  FLOAT_BOB: 0.06,

  /** Phát sáng tối đa (glow = 1) — theo cao bảng ký. */
  GLOW_MAX: 0.12,
  /** Khoảng cách tên dưới chữ ký — theo cao dòng tên. */
  NAME_GAP: 0.15,

  EXPORT_HEIGHT_PX: 720,
  THUMB_HEIGHT_PX: 72,
  MANAGER_PAGE_SIZE: 60,

  CURSOR_HIDE_MS: 2500,
  MEDIA_UPLOAD_TIMEOUT_MS: 10 * 60 * 1000,
  MEDIA_MAX_BYTES: 300 * 1024 * 1024,

  /** Khung xuất 16:9 hay gặp. */
  FRAME_PRESETS: [
    { label: 'Full HD 1920×1080', w: 1920, h: 1080 },
    { label: 'HD 1280×720', w: 1280, h: 720 },
    { label: '4K 3840×2160', w: 3840, h: 2160 },
  ],
}

/** Font web cho tên. Mạng LAN không internet thì trình duyệt rơi về font hệ
 *  thống — vẫn hiện chữ, chỉ không đẹp bằng. */
export const WEB_FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@600;800&family=Charm:wght@700&family=Dancing+Script:wght@700&family=Great+Vibes&family=Lobster&family=Montserrat:wght@700;900&family=Pacifico&display=swap'

export const LS_KEYS = {
  adminKey: (eventId) => `perf_key_${eventId}`,
  lastEvent: 'perf_last_event',
  signed: (eventId) => `perf_signed_${eventId}`,
}

export const PERF_ROUTES = {
  setup: (id) => `/perf/${id}/setup`,
  show: (id) => `/perf/${id}/show`,
  sign: (id) => `/s/${id}`,
}
