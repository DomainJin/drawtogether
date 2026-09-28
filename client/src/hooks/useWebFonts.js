import { useEffect, useState } from 'react'
import { WEB_FONTS_HREF } from '../performance/config.js'
import { clearMeasureCache } from '../performance/render/drawSignature.js'

const LINK_ID = 'perf-web-fonts'

/** Nạp font web cho tên chữ ký; trả số phiên bản tăng mỗi khi có font mới tải
 *  xong — canvas phải vẽ lại (và đo lại) vì lần trước đã vẽ bằng font dự phòng.
 *  Canvas không tự tải font: phải gọi document.fonts.load cho font đang dùng. */
export function useWebFonts(activeFont) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!document.getElementById(LINK_ID)) {
      const link = document.createElement('link')
      link.id = LINK_ID
      link.rel = 'stylesheet'
      link.href = WEB_FONTS_HREF
      document.head.appendChild(link)
    }
    const bump = () => {
      clearMeasureCache()
      setVersion((v) => v + 1)
    }
    document.fonts?.addEventListener?.('loadingdone', bump)
    return () => document.fonts?.removeEventListener?.('loadingdone', bump)
  }, [])

  useEffect(() => {
    if (!activeFont || !document.fonts?.load) return
    let alive = true
    document.fonts.load(`40px "${activeFont}"`).then(() => {
      if (!alive) return
      clearMeasureCache()
      setVersion((v) => v + 1)
    }).catch(() => { /* offline → font dự phòng */ })
    return () => { alive = false }
  }, [activeFont])

  return version
}
