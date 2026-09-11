import { useEffect } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'

/** Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y cho lưới van.
 *
 *  Tách khỏi component thanh công cụ vì nó không phải chuyện hiển thị, và vì
 *  giờ có hai thanh (dock trên điện thoại, pill trên desktop) dùng chung cùng
 *  một bộ nút — phím tắt chỉ được đăng ký MỘT lần, không phải mỗi thanh một
 *  lần.
 *
 *  Chỉ chạy khi đang ở chế độ màn nước vì component gọi nó chỉ mount lúc đó,
 *  nên không đụng phím tắt của whiteboard.
 */
export function useUndoShortcuts() {
  const undoStroke = useWaterfallStore((s) => s.undoStroke)
  const redoStroke = useWaterfallStore((s) => s.redoStroke)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k !== 'z' && k !== 'y') return
      if (e.target.matches?.('input,textarea')) return
      e.preventDefault()
      if (k === 'y' || e.shiftKey) redoStroke()
      else undoStroke()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [undoStroke, redoStroke])
}
