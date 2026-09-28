export const C = {
  bg: '#0f1117',
  panel: '#161a23',
  card: '#1d2230',
  border: 'rgba(255,255,255,0.08)',
  text: '#e8eaf0',
  muted: '#8b93a7',
  accent: '#ffd166',
  danger: '#ef476f',
  ok: '#06d6a0',
}

export const sectionStyle = {
  background: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 12,
  padding: '12px 14px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
}

export const sectionTitleStyle = { fontSize: 13, fontWeight: 700, color: C.accent, letterSpacing: 0.4, textTransform: 'uppercase' }

export const fieldStyle = { display: 'grid', gridTemplateColumns: '118px 1fr', alignItems: 'center', gap: 10, fontSize: 13 }
export const labelStyle = { color: C.muted }
export const valueStyle = { minWidth: 52, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: C.text, fontSize: 12 }

export const inputStyle = {
  width: '100%', height: 30, borderRadius: 7, border: `1px solid ${C.border}`,
  background: '#0c0f15', color: C.text, padding: '0 8px', fontSize: 13, outline: 'none', minWidth: 0,
}

export function btnStyle(kind = 'default', disabled = false) {
  const bg = { default: 'rgba(255,255,255,0.08)', primary: C.accent, danger: 'rgba(239,71,111,0.18)', ok: 'rgba(6,214,160,0.18)' }[kind]
  const fg = { default: C.text, primary: '#1a1a1a', danger: '#ff8fa8', ok: '#5ff5c8' }[kind]
  return {
    height: 30, padding: '0 12px', borderRadius: 7, border: `1px solid ${C.border}`,
    background: bg, color: fg, fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1,
  }
}

export function tabStyle(active) {
  return {
    flex: 1, height: 34, border: 'none', borderRadius: 8, cursor: 'pointer',
    background: active ? C.card : 'transparent', color: active ? C.accent : C.muted,
    fontSize: 12.5, fontWeight: 700,
  }
}
