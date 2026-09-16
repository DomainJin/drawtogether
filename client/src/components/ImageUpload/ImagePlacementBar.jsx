import { barBtnStyle, barStyle } from './styles.js'

/** Thanh nổi cố định trên màn hình (không nằm trong lớp bị zoom) — nút Đặt/Huỷ
 *  phải luôn đọc được, kể cả khi đang zoom 5%. */
export default function ImagePlacementBar({ pending, busy, error, onConfirm, onCancel }) {
  if (busy) {
    return <div style={barStyle}>⚙️ Đang xử lý ảnh...</div>
  }
  if (pending) {
    return (
      <div style={barStyle}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          🖼 Kéo để dời · kéo chấm xanh để đổi cỡ
        </span>
        <button onClick={onCancel} title="Huỷ (Esc)" style={barBtnStyle(false)}>Huỷ</button>
        <button onClick={onConfirm} title="Đặt ảnh (Enter)" style={barBtnStyle(true)}>Đặt ảnh</button>
      </div>
    )
  }
  if (error) {
    return <div style={{ ...barStyle, background: 'rgba(226,75,74,0.95)', padding: '8px 16px' }}>{error}</div>
  }
  return null
}
