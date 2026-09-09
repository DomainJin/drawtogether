import { useEffect, useRef, useCallback } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { brushRadii, pointCells, strokeCells } from '../../waterfall/brush.js'
import { fitBox, patternAspect } from '../../waterfall/geometry.js'
import { createGridRenderer } from './gridRenderer.js'
import { createStrokeRenderer } from './strokeRenderer.js'

const ON_COLOR = '#1a1a1a'
const OFF_COLOR = '#ffffff'
const GRID_LINE = 'rgba(0,0,0,0.06)'
const PAGE_COLOR = '#f2f2f0'

/**
 * Vẽ hoạ tiết cho màn nước.
 *
 * Hai việc chạy song song trên cùng một thao tác:
 *  - HIỂN THỊ: nét vector ở độ phân giải màn hình, mượt như whiteboard.
 *  - TÍNH TOÁN: `grid` cập nhật ngay theo từng đoạn nét, kể cả khi tẩy.
 *
 * Tách ra vì ô lưới không vuông: vẽ thẳng từ lưới thì nét ngang dày hơn nét
 * dọc tới 3,5 lần. Thứ gửi đi vẫn chỉ là `grid` — nút "Lưới" cho đối chiếu.
 *
 * Khung vẽ lấy đúng tỉ lệ hoạ tiết sẽ có ngoài đời (xem geometry.js) thay vì
 * kéo giãn cho đầy màn hình, nhờ vậy nét tròn trên màn hình mới tròn trên màn
 * nước. Đổi tốc độ rơi là đổi khoảng cách hàng thật, nên khung đổi theo.
 */
export default function WaterfallCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  /** Chỉ số nét đang vẽ, null khi đã nhấc tay. */
  const activeIndexRef = useRef(null)
  /** Điểm cuối theo toạ độ ô, để nội suy phần cập nhật lưới. */
  const lastCellPointRef = useRef(null)
  const gridRendererRef = useRef(null)
  const strokeRendererRef = useRef(null)
  /** Kích thước logic (CSS px) — canvas.width đã nhân devicePixelRatio. */
  const sizeRef = useRef({ width: 0, height: 0 })
  const aspectRef = useRef(1)
  const resizeRef = useRef(null)

  const {
    grid, cols, rowCount, rowIntervalMs, brushTool, brushPx, paintCells,
    strokes, beginStroke, extendStroke, showGridPreview,
  } = useWaterfallStore()

  const aspect = patternAspect({
    cols, rowCount, rowIntervalMs,
    valvesPerMeter: CFG.VALVES_PER_METER,
    curtainHeightM: CFG.CURTAIN_HEIGHT_M,
  })

  if (!gridRendererRef.current) gridRendererRef.current = createGridRenderer()
  if (!strokeRendererRef.current) strokeRendererRef.current = createStrokeRenderer()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { width, height } = sizeRef.current
    if (!width || !height) return
    const ctx = canvas.getContext('2d')

    if (showGridPreview) {
      gridRendererRef.current(ctx, {
        grid, cols, rowCount, width, height,
        onColor: ON_COLOR,
        offColor: OFF_COLOR,
        gridLineColor: GRID_LINE,
        rowOverlap: CFG.PREVIEW_ROW_OVERLAP,
        cornerRound: CFG.PREVIEW_CORNER_ROUND,
        connectGapCells: CFG.PREVIEW_CONNECT_GAP_CELLS,
      })
      return
    }

    strokeRendererRef.current(ctx, {
      strokes, width, height,
      background: OFF_COLOR,
      activeIndex: activeIndexRef.current,
    })
  }, [grid, cols, rowCount, strokes, showGridPreview])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      const box = container.getBoundingClientRect()
      const fit = fitBox(box.width, box.height, aspectRef.current)
      canvas.style.width = `${fit.width}px`
      canvas.style.height = `${fit.height}px`
      canvas.style.left = `${fit.left}px`
      canvas.style.top = `${fit.top}px`

      // Vẽ theo mật độ điểm thật của màn hình, nếu không nét bị nhoè thêm một
      // lần nữa trên máy retina.
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(fit.width * dpr)
      canvas.height = Math.round(fit.height * dpr)
      canvas.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0)
      sizeRef.current = { width: fit.width, height: fit.height }
      draw()
    }

    resizeRef.current = resize
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Đổi tốc độ rơi hay số hàng là đổi luôn tỉ lệ thật của hoạ tiết.
  useEffect(() => {
    aspectRef.current = aspect
    resizeRef.current?.()
  }, [aspect])

  useEffect(() => { draw() }, [draw])

  /** Con trỏ ở hai hệ toạ độ: chuẩn hoá 0..1 để lưu nét, và theo ô (giữ phần
   *  lẻ) để cập nhật lưới. */
  const pointFromEvent = useCallback((e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const nx = (e.clientX - rect.left) / rect.width
    const ny = (e.clientY - rect.top) / rect.height
    return {
      norm: { x: nx, y: ny },
      cell: { col: nx * cols, row: ny * rowCount },
      cellW: rect.width / cols,
      cellH: rect.height / rowCount,
    }
  }, [cols, rowCount])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.target.setPointerCapture(e.pointerId)

    const p = pointFromEvent(e)
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    activeIndexRef.current = useWaterfallStore.getState().strokes.length
    beginStroke(p.norm, brushTool, brushPx)
    lastCellPointRef.current = p.cell
    // Bút luôn tô 1, tẩy luôn tô 0 — đồ lại lên vùng đã vẽ thì dày thêm, không xoá.
    paintCells(pointCells(p.cell, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
  }, [pointFromEvent, brushPx, brushTool, paintCells, beginStroke])

  const onPointerMove = useCallback((e) => {
    if (activeIndexRef.current === null) return
    e.preventDefault()

    const p = pointFromEvent(e)
    const from = lastCellPointRef.current || p.cell
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    extendStroke(p.norm)
    paintCells(strokeCells(from, p.cell, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
    lastCellPointRef.current = p.cell
  }, [pointFromEvent, brushPx, brushTool, paintCells, extendStroke])

  const stopPainting = useCallback(() => {
    activeIndexRef.current = null
    lastCellPointRef.current = null
  }, [])

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', background: PAGE_COLOR }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block', position: 'absolute',
          cursor: 'crosshair', touchAction: 'none',
          boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPainting}
        onPointerCancel={stopPainting}
        onPointerLeave={stopPainting}
      />
    </div>
  )
}
