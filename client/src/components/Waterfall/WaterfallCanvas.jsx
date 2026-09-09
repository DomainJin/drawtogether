import { useEffect, useRef, useCallback } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { WATERFALL_CONFIG as CFG } from '../../waterfall/config.js'
import { brushRadii, pointCells, strokeCells } from '../../waterfall/brush.js'
import { canvasSizeForWidth, patternAspect, renderScale } from '../../waterfall/geometry.js'
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
 * Canvas vừa BỀ NGANG và giữ đúng tỉ lệ hoạ tiết ngoài đời (xem geometry.js),
 * nên thường cao hơn màn hình và phải cuộn. Một ngón để vẽ, HAI ngón để cuộn —
 * canvas phải nuốt cử chỉ chạm thì nét mới không bị đứt giữa chừng.
 */
export default function WaterfallCanvas() {
  const canvasRef = useRef(null)
  const scrollRef = useRef(null)
  /** Chỉ số nét đang vẽ, null khi đã nhấc tay. */
  const activeIndexRef = useRef(null)
  /** Điểm cuối theo toạ độ ô, để nội suy phần cập nhật lưới. */
  const lastCellPointRef = useRef(null)
  /** Các ngón đang chạm — quyết định vẽ hay cuộn. */
  const pointersRef = useRef(new Map())
  const panLastYRef = useRef(null)
  const gridRendererRef = useRef(null)
  const strokeRendererRef = useRef(null)
  /** Kích thước logic (CSS px). */
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
    const scroller = scrollRef.current
    if (!canvas || !scroller) return

    const resize = () => {
      const { width, height } = canvasSizeForWidth(scroller.clientWidth, aspectRef.current)
      if (!width || !height) return
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`

      // Vẽ theo mật độ điểm thật của màn hình, nhưng hạ xuống nếu canvas quá
      // lớn — vượt giới hạn trình duyệt là mất trắng cả bản vẽ.
      const scale = renderScale(width, height, window.devicePixelRatio || 1)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      canvas.getContext('2d').setTransform(scale, 0, 0, scale, 0, 0)
      sizeRef.current = { width, height }
      draw()
    }

    resizeRef.current = resize
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(scroller)
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

  const endStroke = useCallback(() => {
    activeIndexRef.current = null
    lastCellPointRef.current = null
  }, [])

  /** Trung điểm các ngón đang chạm, theo trục dọc. */
  const midY = () => {
    const ys = [...pointersRef.current.values()].map((p) => p.y)
    return ys.reduce((a, b) => a + b, 0) / ys.length
  }

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.target.setPointerCapture(e.pointerId)
    pointersRef.current.set(e.pointerId, { y: e.clientY })

    if (pointersRef.current.size > 1) {
      // Ngón thứ hai đặt xuống là chuyển sang cuộn. Nét đang vẽ dừng tại đây,
      // phần đã vẽ giữ nguyên — không lặng lẽ xoá thứ người dùng vừa vạch ra.
      endStroke()
      panLastYRef.current = midY()
      return
    }

    const p = pointFromEvent(e)
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    activeIndexRef.current = useWaterfallStore.getState().strokes.length
    beginStroke(p.norm, brushTool, brushPx)
    lastCellPointRef.current = p.cell
    // Bút luôn tô 1, tẩy luôn tô 0 — đồ lại lên vùng đã vẽ thì dày thêm, không xoá.
    paintCells(pointCells(p.cell, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
  }, [pointFromEvent, brushPx, brushTool, paintCells, beginStroke, endStroke])

  const onPointerMove = useCallback((e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    e.preventDefault()
    pointersRef.current.set(e.pointerId, { y: e.clientY })

    if (pointersRef.current.size > 1) {
      const y = midY()
      if (panLastYRef.current !== null && scrollRef.current) {
        scrollRef.current.scrollTop -= y - panLastYRef.current
      }
      panLastYRef.current = y
      return
    }

    if (activeIndexRef.current === null) return

    const p = pointFromEvent(e)
    const from = lastCellPointRef.current || p.cell
    const { radRows, radCols } = brushRadii(brushPx, p.cellW, p.cellH)

    extendStroke(p.norm)
    paintCells(strokeCells(from, p.cell, radRows, radCols), brushTool === 'eraser' ? 0 : 1)
    lastCellPointRef.current = p.cell
  }, [pointFromEvent, brushPx, brushTool, paintCells, extendStroke])

  const onPointerEnd = useCallback((e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) panLastYRef.current = null
    // Nhấc bớt còn một ngón thì KHÔNG vẽ tiếp: ngón còn lại đang ở giữa cử chỉ
    // cuộn, vẽ tiếp sẽ để lại một vạch không ai muốn.
    if (pointersRef.current.size === 0) endStroke()
  }, [endStroke])

  return (
    <div
      ref={scrollRef}
      style={{
        width: '100%', height: '100%',
        overflowY: 'auto', overflowX: 'hidden',
        background: PAGE_COLOR,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block', cursor: 'crosshair',
          // Nuốt cử chỉ chạm để trình duyệt không tự cuộn giữa lúc đang vẽ;
          // phần cuộn hai ngón do onPointerMove lo.
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      />
    </div>
  )
}
