import { useEffect, useRef, useCallback } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'
import { brushRadii, pointCells, strokeCells } from '../../waterfall/brush.js'

const ON_COLOR = '#378ADD'
const OFF_COLOR = '#eef3f8'
const GRID_LINE = 'rgba(0,0,0,0.06)'

/** Dưới ngưỡng này thì lưới dày tới mức đường kẻ lấn hết ô — vẽ xong chỉ thấy
 *  một mảng xám. Màn 4 m có 160 cột nên trên điện thoại luôn rơi vào trường
 *  hợp này. */
const MIN_CELL_PX_FOR_GRID_LINES = 6

export default function WaterfallCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const isPaintingRef = useRef(false)
  /** Điểm cuối của nét, toạ độ ô dạng số thực. Nội suy từ đây tới điểm mới. */
  const lastPointRef = useRef(null)

  const { grid, cols, rowCount, brushTool, brushPx, paintCells } = useWaterfallStore()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const cellW = width / cols
    const cellH = height / rowCount

    ctx.fillStyle = OFF_COLOR
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = ON_COLOR
    for (let r = 0; r < rowCount; r++) {
      const row = grid[r]
      if (!row) continue
      for (let c = 0; c < cols; c++) {
        if (!row[c]) continue
        // Math.ceil để các ô kề nhau không hở sọc trắng khi cellW < 1px.
        ctx.fillRect(c * cellW, r * cellH, Math.ceil(cellW), Math.ceil(cellH))
      }
    }

    ctx.strokeStyle = GRID_LINE
    ctx.lineWidth = 1
    ctx.beginPath()
    if (cellW >= MIN_CELL_PX_FOR_GRID_LINES) {
      for (let c = 0; c <= cols; c++) {
        const x = Math.round(c * cellW) + 0.5
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
      }
    }
    if (cellH >= MIN_CELL_PX_FOR_GRID_LINES) {
      for (let r = 0; r <= rowCount; r++) {
        const y = Math.round(r * cellH) + 0.5
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
      }
    }
    ctx.stroke()
  }, [grid, cols, rowCount])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const resize = () => {
      const { width, height } = container.getBoundingClientRect()
      canvas.width = width
      canvas.height = height
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
