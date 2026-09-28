export const pageStyle = {
  position: 'fixed',
  inset: 0,
  background: '#101828',
  color: '#fff',
  fontFamily: '"Be Vietnam Pro", system-ui, sans-serif',
}

/** Cuộn được: body toàn app để overflow hidden (bảng vẽ), điện thoại nhỏ dọc
 *  thì trang ký có thể cao hơn màn hình. */
export const scrollStyle = {
  position: 'absolute',
  inset: 0,
  overflowY: 'auto',
  WebkitOverflowScrolling: 'touch',
}

export const columnStyle = {
  position: 'relative',
  maxWidth: 760,
  margin: '0 auto',
  padding: 'max(20px, env(safe-area-inset-top)) 16px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 14,
}

export const titleStyle = { fontSize: 26, fontWeight: 800, textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }
export const subtitleStyle = { fontSize: 15, opacity: 0.85, textAlign: 'center', lineHeight: 1.45 }

export const rowStyle = { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }

export function ghostBtn(disabled) {
  return {
    height: 42, padding: '0 16px', borderRadius: 21, border: '1px solid rgba(255,255,255,0.35)',
    background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 15, fontWeight: 600,
    opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
  }
}

export function primaryBtn(disabled) {
  return {
    height: 54, borderRadius: 27, border: 'none', width: '100%',
    background: 'linear-gradient(90deg, #ffd166, #ef476f)', color: '#1a1a1a',
    fontSize: 18, fontWeight: 800, letterSpacing: 0.3,
    opacity: disabled ? 0.45 : 1, cursor: disabled ? 'default' : 'pointer',
    boxShadow: disabled ? 'none' : '0 6px 24px rgba(239,71,111,0.45)',
  }
}

export function swatchStyle(color, active) {
  return {
    width: 34, height: 34, borderRadius: '50%', background: color, cursor: 'pointer',
    border: active ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)',
    boxShadow: active ? '0 0 0 2px rgba(0,0,0,0.4)' : 'none', padding: 0,
  }
}

export const inputStyle = {
  width: '100%', height: 50, borderRadius: 12, padding: '0 16px',
  border: '1.5px solid rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.3)',
  color: '#fff', fontSize: 17, outline: 'none',
}

export const errorStyle = {
  background: 'rgba(239,71,111,0.9)', borderRadius: 10, padding: '10px 14px',
  fontSize: 15, fontWeight: 600, textAlign: 'center',
}

export const centerStyle = {
  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, textAlign: 'center',
}
