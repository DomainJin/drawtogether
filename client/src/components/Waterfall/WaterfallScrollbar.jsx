import { useCallback, useRef } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { getScroller, scrollToFraction } from './scrollController.js'

const TRACK_WIDTH = 10
const MIN_THUMB = 36

/**
 * Thanh cuộn dọc tự vẽ cho khung vẽ.
 *
 * iOS ẩn thanh cuộn gốc cho tới lúc đang cuộn, mà canvas lại đặt
 * `touch-action: none` để nuốt cử chỉ chạm (một ngón vẽ, hai ngón cuộn) — nên
 * người dùng không có manh mối nào rằng bên dưới còn hoạ tiết. Thanh này luôn
 * hiện khi có chỗ để cuộn, và kéo được bằng một ngón.
 */
export default function WaterfallScrollbar({ bottomOffset }) {
  const { scrollTop, viewHeight, contentHeight } = useWaterfallStore((s) => s.viewport)
  const draggingRef = useRef(false)

  const scrollable = contentHeight - viewHeight
  const trackTop = 8
  const trackHeight = Math.max(0, viewHeight - trackTop * 2)

  const jumpTo = useCallback((clientY) => {
    const scroller = getScroller()
    if (!scroller) return
    const rect = scroller.getBoundingClientRect()
    const y = clientY - rect.top - trackTop
    const usable = Math.max(1, rect.height - trackTop * 2 - MIN_THUMB)
    scrollToFraction((y - MIN_THUMB / 2) / usable)
  }, [])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    e.target.setPointerCapture(e.pointerId)
    draggingRef.current = true
    jumpTo(e.clientY)
  }, [jumpTo])

  const onPointerMove = useCallback((e) => {
    if (!draggingRef.current) return
    e.preventDefault()
    jumpTo(e.clientY)
  }, [jumpTo])

  const onPointerEnd = useCallback(() => { draggingRef.current = false }, [])

  // Không có gì để cuộn thì không bày thêm thứ gây nhiễu.
  if (scrollable <= 1 || trackHeight <= 0) return null

  const thumbHeight = Math.max(MIN_THUMB, (viewHeight / contentHeight) * trackHeight)
  const thumbTop = (scrollTop / scrollable) * (trackHeight - thumbHeight)

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{
        position: 'absolute', top: trackTop, right: 4,
        width: TRACK_WIDTH, height: trackHeight,
        // Vùng chạm rộng hơn phần nhìn thấy — ngón tay không trúng dải 10px.
        padding: '0 8px', boxSizing: 'content-box',
        touchAction: 'none', cursor: 'pointer', zIndex: 3,
        marginBottom: bottomOffset,
      }}
    >
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        borderRadius: TRACK_WIDTH / 2, background: 'rgba(0,0,0,0.06)',
      }}>
        <div style={{
          position: 'absolute', left: 0, width: '100%',
          top: thumbTop, height: thumbHeight,
          borderRadius: TRACK_WIDTH / 2,
          background: 'rgba(0,0,0,0.32)',
        }} />
      </div>
    </div>
  )
}
