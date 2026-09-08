import { useEffect, useState } from 'react'

/** Dưới ngưỡng này coi là điện thoại: panel chuyển thành bottom sheet, canvas
 *  chiếm trọn bề ngang. Trên ngưỡng giữ nguyên panel cột phải như cũ. */
export const MOBILE_BREAKPOINT_PX = 768

/** Theo dõi bề ngang viewport. Dùng matchMedia thay vì đọc innerWidth mỗi
 *  render để không phải re-render theo từng pixel khi xoay máy. */
export function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`
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
 *  Trên điện thoại sheet mặc định thu gọn để chừa tối đa chỗ vẽ — mở rộng chỉ
 *  khi cần chỉnh thông số. Trên desktop panel luôn mở, không có khái niệm thu
 *  gọn, nên `expanded` phải luôn true để cùng một JSX dùng được cho cả hai. */
export function useWaterfallPanel() {
  const isMobile = useIsMobile()
  const [sheetOpen, setSheetOpen] = useState(false)

  const expanded = !isMobile || sheetOpen

  return {
    isMobile,
    expanded,
    toggleSheet: () => setSheetOpen((v) => !v),
    closeSheet: () => setSheetOpen(false),
  }
}
