import { WATERFALL_UI as UI } from '../../waterfall/config.js'

/** Style cho WaterfallPanel. Tách khỏi file component để phần render chỉ còn
 *  cấu trúc, và để layout mobile/desktop nằm cạnh nhau dễ đối chiếu.
 *  Mọi kích thước lấy từ WATERFALL_UI — WhiteboardPage dùng chung bộ số đó để
 *  chừa chỗ cho canvas. */

/** Chiều cao tối đa khi mở rộng trên mobile — chừa lại một phần canvas để còn
 *  thấy hoạ tiết vừa vẽ trong lúc chỉnh thông số. */
const SHEET_MAX_HEIGHT = '76vh'

const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

const CARD_SURFACE = {
  background: 'rgba(255,255,255,0.97)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
  zIndex: 100,
}

export function panelStyle(isMobile, expanded) {
  if (isMobile) {
    return {
      position: 'fixed', left: 0, right: 0, bottom: 0,
      maxHeight: expanded ? SHEET_MAX_HEIGHT : 'none',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(0,0,0,0.08)',
      borderRadius: '18px 18px 0 0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.14)',
      zIndex: 100, fontSize: 15,
      paddingBottom: `calc(10px + ${SAFE_BOTTOM})`,
    }
  }

  // Desktop thu gọn: thẻ nhỏ nổi góc dưới phải, trả lại toàn bộ bảng vẽ.
  if (!expanded) {
    return {
      ...CARD_SURFACE,
      position: 'fixed', right: 16, bottom: 16,
      width: UI.COMPACT_CARD_PX,
      display: 'flex', flexDirection: 'column',
      borderRadius: 14, padding: '12px 14px', fontSize: 13,
    }
  }

  return {
    ...CARD_SURFACE,
    position: 'fixed', right: 16, top: 80, bottom: 100,
    width: UI.PANEL_WIDTH_PX,
    display: 'flex', flexDirection: 'column', gap: 12,
    borderRadius: 16, padding: 16, overflowY: 'auto', fontSize: 13,
  }
}

/** Vùng cuộn chứa các Section. Trên desktop dùng display:contents để các
 *  Section tham gia trực tiếp vào flex của panel như trước. */
export function sheetBodyStyle(isMobile) {
  if (!isMobile) return { display: 'contents' }
  // minHeight: 0 là bắt buộc — không có nó, flex item ôm trọn chiều cao nội
  // dung và sheet tràn khỏi maxHeight thay vì cuộn bên trong.
  return {
    display: 'flex', flexDirection: 'column', gap: 14,
    padding: '4px 16px 12px', flex: '1 1 auto', minHeight: 0,
    overflowY: 'auto', WebkitOverflowScrolling: 'touch',
  }
}

export const grabberWrapStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '8px 0 4px', cursor: 'pointer', flexShrink: 0,
}

export const grabberStyle = {
  width: 40, height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.18)',
}

export function collapsedBarStyle(isMobile) {
  return {
    display: 'flex', flexDirection: 'column', gap: 10,
    padding: isMobile ? '6px 16px 0' : 0, flexShrink: 0,
  }
}

export function collapsedStatusRowStyle(isMobile) {
  return {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: isMobile ? 14 : 13, color: '#444',
  }
}

export const sendRowStyle = { display: 'flex', gap: 10 }

export function dotStyle(color) {
  return { width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }
}

// ── Nút & input ──────────────────────────────────────────────────────────────
// Mobile dùng vùng chạm >= 44px theo khuyến nghị của iOS.

export function primaryBtnStyle(isMobile) {
  return {
    padding: isMobile ? '15px 16px' : '10px', borderRadius: isMobile ? 12 : 8,
    border: 'none', background: '#1a1a1a', color: '#fff',
    fontSize: isMobile ? 16 : 13, fontWeight: 600, cursor: 'pointer',
  }
}

export function secondaryBtnStyle(isMobile) {
  return {
    padding: isMobile ? '14px 16px' : '8px', borderRadius: isMobile ? 12 : 8,
    border: '1.5px solid #ddd', background: 'transparent', color: '#1a1a1a',
    fontSize: isMobile ? 15 : 13, fontWeight: 500, cursor: 'pointer',
  }
}

export function dangerBtnStyle(isMobile) {
  return { ...primaryBtnStyle(isMobile), background: 'rgba(226,75,74,0.1)', color: '#E24B4A' }
}

export function inputStyle(isMobile) {
  return {
    padding: isMobile ? '12px' : '8px 10px', borderRadius: 8,
    border: '1.5px solid #ddd', fontSize: isMobile ? 16 : 13,
    outline: 'none', boxSizing: 'border-box',
  }
}

/** Range mặc định trên iOS có vùng chạm rất mỏng — nới chiều cao để kéo trúng. */
export function rangeStyle(isMobile) {
  return { width: '100%', height: isMobile ? 34 : 'auto', accentColor: '#378ADD' }
}

export function modeTabStyle(active, isMobile) {
  return {
    flex: 1, padding: isMobile ? '12px 6px' : '8px 6px', border: 'none', cursor: 'pointer',
    background: active ? '#1a1a1a' : 'transparent',
    color: active ? '#fff' : '#444',
    fontSize: isMobile ? 15 : 12, fontWeight: 600,
  }
}

export const backBtnStyle = {
  fontSize: 13, padding: '6px 12px', borderRadius: 8,
  border: '1px solid rgba(0,0,0,0.12)', background: 'transparent',
  cursor: 'pointer', color: '#378ADD',
}

// ── Dock đáy trên điện thoại ────────────────────────────────────────────────
// Một hàng duy nhất: vùng công cụ cuộn ngang + hai nút hành động ghim phải.
// Xem WaterfallDock.jsx cho lý do bố cục.

/** Thanh cuộn ngang của dock phải TÀNG HÌNH: nó nằm ngay dưới các nút, hiện ra
 *  thì vừa ăn thêm vài pixel chiều cao vừa nhấp nháy mỗi lần chạm. iOS tự ẩn,
 *  còn Chrome Android và desktop thì không — nên phải nói rõ. */
export const HIDE_SCROLLBAR_CSS = `
.wf-dock-scroll { scrollbar-width: none; -ms-overflow-style: none; }
.wf-dock-scroll::-webkit-scrollbar { display: none; }
`

export const dockBarStyle = {
  position: 'fixed', left: 0, right: 0, bottom: 0,
  display: 'flex', alignItems: 'center', gap: UI.DOCK_GAP_PX,
  height: UI.DOCK_HEIGHT_PX,
  padding: `0 ${UI.DOCK_PAD_X_PX}px`,
  paddingBottom: SAFE_BOTTOM,
  boxSizing: 'content-box',
  background: 'rgba(255,255,255,0.98)',
  backdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 -2px 14px rgba(0,0,0,0.08)',
  zIndex: 110,
}

export const dockScrollStyle = {
  display: 'flex', alignItems: 'center', gap: UI.TOOLBAR_GROUP_GAP_PX,
  // nowrap + overflowX là cả ý tưởng: công cụ tràn thì cuộn ngang, KHÔNG
  // xuống dòng — xuống dòng là ăn thêm một tầng chỗ vẽ.
  flexWrap: 'nowrap', overflowX: 'auto', overflowY: 'hidden',
  WebkitOverflowScrolling: 'touch',
  flex: '1 1 auto', minWidth: 0,
  // Cuộn ngang bằng ngón tay không được để trình duyệt hiểu nhầm thành cuộn
  // trang; dọc thì vẫn nhường cho trang.
  touchAction: 'pan-x',
  paddingBlock: 4,
}

/** Nút hành động ghim bên phải dock. `primary` là nút gửi (đen, nổi bật),
 *  `ghost` là cài đặt (viền nhạt, không tranh chỗ với nút gửi). */
export function dockActionBtnStyle({ variant, disabled }) {
  const size = UI.DOCK_ACTION_BTN_PX
  const base = {
    position: 'relative',
    width: size, height: size, flexShrink: 0, padding: 0,
    borderRadius: 12, fontSize: 19,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
  }
  if (variant === 'primary') {
    return {
      ...base,
      border: 'none', background: '#1a1a1a', color: '#fff',
      opacity: disabled ? 0.45 : 1,
    }
  }
  return {
    ...base,
    border: '1.5px solid #ddd', background: 'transparent', color: '#444',
  }
}

/** Thông báo lỗi nổi phía trên dock, không chiếm hàng riêng trong dock. Là
 *  BUTTON để chạm vào là tắt — lỗi gửi không tự hết, để nguyên thì nó che hoạ
 *  tiết cho tới lần gửi sau. */
export const dockToastStyle = {
  position: 'absolute', left: 10, right: 10, bottom: 'calc(100% + 8px)',
  border: 'none', textAlign: 'left', cursor: 'pointer',
  padding: '8px 12px', borderRadius: 10,
  background: 'rgba(226,75,74,0.95)', color: '#fff',
  fontSize: 13, lineHeight: 1.35,
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
}
