import { useCallback, useEffect, useRef } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { createGridRenderer } from './gridRenderer.js'
import { scrollToFraction } from './scrollController.js'

const WIDTH = 56
const ON_COLOR = '#1a1a1a'
const OFF_COLOR = '#ffffff'

/**
 * Bản đồ thu nhỏ của cả hoạ tiết, kèm khung báo đang xem vùng nào.
 *
 * Khung vẽ cao gấp mấy lần màn hình điện thoại nên rất dễ lạc: cuộn một lúc là
 * không biết mình đang ở đầu, giữa hay cuối. Chạm vào đây là nhảy thẳng tới
 * vùng đó.
 *
 * Vẽ từ `grid` bằng CHÍNH bộ render của khung lớn, nên thứ nhìn thấy ở đây là
 * đúng dữ liệu sẽ gửi đi, chỉ nhỏ lại.
 */
export default function WaterfallMiniMap({ bottomOffset }) {
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const draggingRef = useRef(false)

  const { grid, cols, rowCount, viewport } = useWaterfallStore()
  const { scrollTop, viewHeight, contentHeight } = viewport

  if (!rendererRef.current) rendererRef.current = createGridRenderer()

  // Cả hoạ tiết nén vào đúng chiều cao hộp, nên phần trăm vị trí trên minimap
  // ứng thẳng với phần trăm cuộn của khung lớn — khung nhìn khỏi phải quy đổi.
  const mapHeight = Math.max(0, Math.min(180, viewHeight - 24 - bottomOffset))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (!w || !h) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
    const ctx = canvas.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    rendererRef.current(ctx, {
      grid, cols, rowCount, width: w, height: h,
      onColor: ON_COLOR,
      offColor: OFF_COLOR,
      gridLineColor: 'rgba(0,0,0,0)',
      rowOverlap: CFG.PREVIEW_ROW_OVERLAP,
      cornerRound: CFG.PREVIEW_CORNER_ROUND,
      connectGapCells: CFG.PREVIEW_CONNECT_GAP_CELLS,
    })
  }, [grid, cols, rowCount, mapHeight])


  const jumpTo = useCallback((clientY) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const visibleShare = contentHeight > 0 ? viewHeight / contentHeight : 1
    const y = (clientY - rect.top) / Math.max(1, rect.height)
    // Canh giữa vùng vừa chạm vào khung nhìn.
    scrollToFraction((y - visibleShare / 2) / Math.max(0.0001, 1 - visibleShare))
  }, [contentHeight, viewHeight])

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

  // Vừa đủ một màn hình thì minimap không nói thêm được gì.
  if (contentHeight <= viewHeight + 1 || viewHeight <= 0 || mapHeight <= 40) return null

  const boxTop = (scrollTop / contentHeight) * 100
  const boxHeight = (viewHeight / contentHeight) * 100

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{
        position: 'absolute', right: 26, top: 12,
        width: WIDTH, height: mapHeight,
        borderRadius: 8, overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
        background: OFF_COLOR,
        touchAction: 'none', cursor: 'pointer', zIndex: 3,
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute', left: 0, width: '100%',
        top: `${boxTop}%`, height: `${boxHeight}%`,
        border: '1.5px solid #378ADD',
        background: 'rgba(55,138,221,0.16)',
        boxSizing: 'border-box', pointerEvents: 'none',
      }} />
    </div>
  )
}
