import { forwardRef } from 'react'
import { mediaUrl } from '../../performance/perfApi.js'

const OBJECT_FIT = { cover: 'cover', contain: 'contain', stretch: 'fill' }

const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%' }

/** Nền màu/ảnh/video dùng chung cho màn show và trang ký.
 *  crossOrigin="anonymous": server khác port với client — thiếu nó thì chụp màn
 *  show (drawImage frame video) làm canvas bị "tainted", không xuất PNG được.
 *  Ref trỏ tới <img>/<video> để chụp. */
const MediaBackground = forwardRef(function MediaBackground({ bg }, ref) {
  const src = mediaUrl(bg.url)
  const fit = OBJECT_FIT[bg.fit] || 'cover'
  return (
    <div style={{ ...fill, background: bg.color, overflow: 'hidden', pointerEvents: 'none' }}>
      {bg.type === 'image' && src && (
        <img ref={ref} key={src} src={src} alt="" crossOrigin="anonymous" draggable={false}
          style={{ ...fill, objectFit: fit }} />
      )}
      {bg.type === 'video' && src && (
        <video ref={ref} key={src} src={src} crossOrigin="anonymous"
          autoPlay muted loop playsInline preload="auto"
          style={{ ...fill, objectFit: fit }} />
      )}
      {bg.dim > 0 && <div style={{ ...fill, background: `rgba(0,0,0,${bg.dim})` }} />}
    </div>
  )
})

export default MediaBackground
