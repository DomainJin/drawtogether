import { useEffect, useState } from 'react'
import { WATERFALL_UI as UI } from '../../waterfall/config.js'
import { useWaterfallStore } from '../../store/waterfallStore.js'

/** Theo dõi bề ngang viewport. Dùng matchMedia thay vì đọc innerWidth mỗi
 *  render để không phải re-render theo từng pixel khi xoay máy. */
export function useIsMobile() {
  const query = `(max-width: ${UI.MOBILE_BREAKPOINT_PX - 1}px)`
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    setIsMobile(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return isMobile
}

/** State hiển thị của panel Màn nước.
 *
 *  Thu gọn được ở MỌI kích thước màn hình — trên desktop panel 280px vẫn chiếm
 *  phần đáng kể của bảng vẽ. Thu gọn rồi thì mobile còn một thanh ở đáy, desktop
 *  còn một thẻ nhỏ nổi góc dưới phải; cả hai đều giữ nút Gửi nên không phải mở
 *  lại chỉ để bắn hoạ tiết. */
export function useWaterfallPanel() {
  const isMobile = useIsMobile()
  const expanded = useWaterfallStore((s) => s.panelOpen)
  const togglePanel = useWaterfallStore((s) => s.togglePanel)

  return { isMobile, expanded, togglePanel }
}
