import { IMAGE_CONFIG as CFG } from '../../whiteboard/config.js'

/** Khung ảnh đang đặt — nằm TRONG lớp stage (toạ độ bảng vẽ), nên tự bám theo
 *  pan/zoom mà không phải tính lại vị trí mỗi frame. Cái giá: mọi độ dày tính
 *  bằng px màn hình phải chia cho zoom. */
export function frameStyle(rect, zoom) {
  return {
    position: 'absolute',
    left: rect.x, top: rect.y, width: rect.w, height: rect.h,
    outline: `${CFG.OUTLINE_SCREEN_PX / zoom}px dashed #378ADD`,
    cursor: 'move',
    touchAction: 'none',
    zIndex: 5,
  }
}

export const previewImgStyle = {
  width: '100%', height: '100%', display: 'block',
  opacity: CFG.PREVIEW_OPACITY,
  pointerEvents: 'none',
  userSelect: 'none',
}

export function handleStyle(zoom) {
  const size = CFG.HANDLE_SCREEN_PX / zoom
  return {
    position: 'absolute',
    right: -size / 2, bottom: -size / 2,
    width: size, height: size,
    borderRadius: '50%',
    background: '#378ADD',
    border: `${2 / zoom}px solid #fff`,
    boxShadow: `0 ${1 / zoom}px ${4 / zoom}px rgba(0,0,0,0.3)`,
    cursor: 'nwse-resize',
    touchAction: 'none',
  }
}

export const barStyle = {
  position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(0,0,0,0.82)', color: '#fff',
  padding: '8px 10px 8px 16px', borderRadius: 20,
  fontSize: 13, zIndex: 400,
  boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
  maxWidth: 'calc(100vw - 24px)',
}

export function barBtnStyle(primary) {
  return {
    height: 30, padding: '0 12px', borderRadius: 15, border: 'none',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, flexShrink: 0,
    background: primary ? '#378ADD' : 'rgba(255,255,255,0.16)',
    color: '#fff',
  }
}
