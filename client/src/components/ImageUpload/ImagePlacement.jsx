import { useRef } from 'react'
import { frameStyle, handleStyle, previewImgStyle } from './styles.js'

/** Khung xem trước ảnh đang đặt: kéo thân để dời, kéo chấm góc để đổi cỡ.
 *
 *  Dùng Pointer Events + setPointerCapture để chuột và ngón tay đi chung một
 *  đường, và kéo ra ngoài khung vẫn không mất thao tác. stopPropagation để cú
 *  chạm không lọt xuống lớp dưới thành nét vẽ hay thao tác pan. */
export default function ImagePlacement({ pending, zoom, onMove, onResize }) {
  const drag = useRef(null)

  if (!pending) return null

  const start = (mode) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, x: e.clientX, y: e.clientY, rect: pending.rect, id: e.pointerId }
  }

  const move = (e) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    e.stopPropagation()
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (d.mode === 'resize') onResize(dx, dy, d.rect)
    else onMove(dx, dy, d.rect)
  }

  const end = (e) => {
    if (drag.current?.id !== e.pointerId) return
    e.stopPropagation()
    drag.current = null
  }

  const pointerProps = (mode) => ({
    onPointerDown: start(mode),
    onPointerMove: move,
    onPointerUp: end,
    onPointerCancel: end,
  })

  return (
    <div style={frameStyle(pending.rect, zoom)} {...pointerProps('move')}>
      <img src={pending.src} alt="" draggable={false} style={previewImgStyle} />
      <div style={handleStyle(zoom)} {...pointerProps('resize')} />
    </div>
  )
}
