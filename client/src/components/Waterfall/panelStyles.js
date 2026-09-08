/** Style cho WaterfallPanel. Tách khỏi file component để phần render chỉ còn
 *  cấu trúc, và để layout mobile/desktop nằm cạnh nhau dễ đối chiếu. */

/** Chiều cao phần sheet luôn nhìn thấy khi thu gọn (px). WhiteboardPage dùng
 *  đúng hằng số này để chừa chỗ cho canvas, nên đổi ở đây là cả hai cùng đổi. */
export const SHEET_COLLAPSED_PX = 148

/** Chiều cao tối đa khi mở rộng — chừa lại một phần canvas để còn thấy hoạ tiết
 *  mình vừa vẽ trong lúc chỉnh thông số. */
const SHEET_MAX_HEIGHT = '76vh'

const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)'

export function panelStyle(isMobile, expanded) {
  if (!isMobile) {
    return {
      position: 'fixed', right: 16, top: 80, bottom: 100, width: 280,
      display: 'flex', flexDirection: 'column', gap: 12,
      background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(0,0,0,0.08)', borderRadius: 16,
      padding: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
      zIndex: 100, overflowY: 'auto', fontSize: 13,
    }
  }
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

/** Vùng cuộn chứa các Section. Trên mobile chỉ tồn tại khi sheet mở. */
export function sheetBodyStyle(isMobile) {
  return isMobile
    // minHeight: 0 là bắt buộc — không có nó, flex item ôm trọn chiều cao nội
    // dung và sheet tràn khỏi maxHeight thay vì cuộn bên trong.
    ? {
        display: 'flex', flexDirection: 'column', gap: 14,
        padding: '4px 16px 12px', flex: '1 1 auto', minHeight: 0,
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
      }
    : { display: 'contents' }
}

/** Thanh kéo + dòng trạng thái gọn, luôn hiện trên mobile. */
export const grabberWrapStyle = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '8px 0 4px', cursor: 'pointer', flexShrink: 0,
}

export const grabberStyle = {
  width: 40, height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.18)',
}

export const collapsedBarStyle = {
  display: 'flex', flexDirection: 'column', gap: 10,
  padding: '6px 16px 0', flexShrink: 0,
}

export const collapsedStatusRowStyle = {
  display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#444',
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
