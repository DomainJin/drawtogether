import { useEffect, useRef, useCallback } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { brushRadii, pointCells, strokeCells } from '../../waterfall/brush.js'
import { createGridRenderer } from './gridRenderer.js'

const ON_COLOR = '#1a1a1a'
const OFF_COLOR = '#ffffff'
const GRID_LINE = 'rgba(0,0,0,0.06)'

export default function WaterfallCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const isPaintingRef = useRef(false)
  /** Điểm cuối của nét, toạ độ ô dạng số thực. Nội suy từ đây tới điểm mới. */
  const lastPointRef = useRef(null)
  const renderRef = useRef(null)
  /** Kích thước logic (CSS px) — canvas.width đã nhân devicePixelRatio nên
   *  không dùng trực tiếp được. */
  const sizeRef = useRef({ width: 0, height: 0 })

  const { grid, cols, rowCount, brushTool, brushPx, paintCells } = useWaterfallStore()

  if (!renderRef.current) renderRef.current = createGridRenderer()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = sizeRef.current
    if (!width || !height) return

    renderRef.current(canvas.getContext('2d'), {
      grid, cols, rowCount, width, height,
      onColor: ON_COLOR,
      offColor: OFF_COLOR,
      gridLineColor: GRID_LINE,
      rowOverlap: CFG.PREVIEW_ROW_OVERLAP,
      cornerRound: CFG.PREVIEW_CORNER_ROUND,
    })
  }, [grid, cols, rowCount])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      // Vẽ theo mật độ điểm thật của màn hình, nếu không nét trên điện thoại
      // retina bị nhoè thêm một lần nữa ngoài phần nội suy.
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { width, height }
      draw()
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { draw() }, [draw])

  /** Vị trí con trỏ theo toạ độ ô, GIỮ phần lẻ — làm tròn sớm khiến nét giật
   *  theo lưới và nội suy mất chính xác. */
  const pointFromEvent = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    return {
      col: ((e.clientX - rect.left) / rect.width) * cols,
      row: ((e.clientY - rect.top) / rect.height) * rowCount,
      cellW: rect.width / cols,
      cellH: rect.height / rowCount,
    }
  }, [cols, rowCount])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.target.setPointerCapture(e.pointerId)

    const p = pointFromEvent(e)
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    isPaintingRef.current = true
    lastPointRef.current = p
    // Bút luôn tô 1, tẩy luôn tô 0. Không đảo theo ô đang chạm, nhờ vậy đồ lại
    // lên vùng đã vẽ chỉ dày thêm chứ không xoá mất.
    paintCells(pointCells(p, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
  }, [pointFromEvent, brushPx, brushTool, paintCells])

  const onPointerMove = useCallback((e) => {
    if (!isPaintingRef.current) return
    e.preventDefault()

    const p = pointFromEvent(e)
    const from = lastPointRef.current || p
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    paintCells(strokeCells(from, p, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
    lastPointRef.current = p
  }, [pointFromEvent, brushPx, brushTool, paintCells])

  const stopPainting = useCallback(() => {
    isPaintingRef.current = false
    lastPointRef.current = null
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPainting}
        onPointerCancel={stopPainting}
        onPointerLeave={stopPainting}
      />
    </div>
  )
}
