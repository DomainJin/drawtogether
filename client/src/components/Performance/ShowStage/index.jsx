import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { canvasPixelScale, fitFrame, qrPlacement } from '../../../performance/stageGeometry.js'
import { stageSnapshot } from '../../../performance/render/exportImages.js'
import MediaBackground from '../MediaBackground.jsx'
import { useQrDataUrl } from '../useQrDataUrl.js'
import { useStageRenderer } from './useStageRenderer.js'
import * as S from './styles.js'

/** Khung xuất 16:9 co vừa khung chứa; vùng LED bên trong có nền + chữ ký + QR.
 *  Dùng cho cả màn show (toàn cửa sổ) và preview trong setup — cùng một
 *  component, cùng renderer (WYSIWYG).
 *
 *  ref.snapshot() → Promise<Blob> PNG đúng kích thước vùng LED. */
const ShowStage = forwardRef(function ShowStage({ config, signUrl, fontVersion, outlineRegion = false }, ref) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const bgRef = useRef(null)
  const qrRef = useRef(null)
  const pxScaleRef = useRef(1)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const out = config.output
  const fit = fitFrame(box.w, box.h, out.frameW, out.frameH)
  pxScaleRef.current = canvasPixelScale(fit.scale, window.devicePixelRatio)

  const { drawFull } = useStageRenderer(canvasRef, pxScaleRef, fontVersion)
  const qrUrl = useQrDataUrl(config.qr.show ? signUrl : '')
  const q = qrPlacement(out.w, out.h, config.qr)

  useImperativeHandle(ref, () => ({
    snapshot: () => stageSnapshot({ config, drawScene: drawFull, bgEl: bgRef.current, qrImg: qrRef.current }),
  }), [config, drawFull])

  // Video nền: trình duyệt có thể chặn autoplay tới khi có tương tác — thử lại
  // mỗi khi config đổi (thường là ngay sau cú bấm của kỹ thuật).
  useEffect(() => {
    const v = bgRef.current
    if (v && v.tagName === 'VIDEO' && v.paused) v.play().catch(() => {})
  }, [config.showBg])

  return (
    <div ref={containerRef} style={S.containerStyle}>
      {fit.scale > 0 && (
        <div style={S.frameStyle(out, fit)}>
          <div style={S.regionStyle(out, outlineRegion, fit.scale)}>
            <MediaBackground ref={bgRef} bg={config.showBg} />
            <canvas ref={canvasRef} style={S.canvasStyle} />
            {config.qr.show && qrUrl && (
              <div style={S.qrBoxStyle(q)}>
                <img ref={qrRef} src={qrUrl} alt="QR" width={q.size} height={q.size} style={{ display: 'block' }} />
                {q.captionH > 0 && <div style={S.qrCaptionStyle(q)}>{config.qr.caption}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

export default ShowStage
