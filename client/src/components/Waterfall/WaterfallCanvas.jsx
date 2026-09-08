import { useEffect, useRef, useCallback } from 'react'
import { useWaterfallStore } from '../../store/waterfallStore.js'

const ON_COLOR = '#378ADD'
const OFF_COLOR = '#eef3f8'
const GRID_LINE = 'rgba(0,0,0,0.06)'

export default function WaterfallCanvas() {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const isPaintingRef = useRef(false)
  const paintValueRef = useRef(1)
  const lastCellRef = useRef({ row: -1, col: -1 })

  const { grid, cols, rowCount, setCell } = useWaterfallStore()

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { width, height } = canvas
    ctx.clearRect(0, 0, width, height)

    const cellW = width / cols
    const cellH = height / rowCount

    for (let r = 0; r < rowCount; r++) {
      const row = grid[r]
      if (!row) continue
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = row[c] ? ON_COLOR : OFF_COLOR
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH)
      }
    }

    ctx.strokeStyle = GRID_LINE
    ctx.lineWidth = 1
    ctx.beginPath()
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * cellW) + 0.5
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
    }
    for (let r = 0; r <= rowCount; r++) {
      const y = Math.round(r * cellH) + 0.5
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
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

  const cellFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const col = Math.floor((x / rect.width) * cols)
    const row = Math.floor((y / rect.height) * rowCount)
    return { row, col }
  }, [cols, rowCount])

  const paintAt = useCallback((row, col) => {
    if (row < 0 || row >= rowCount || col < 0 || col >= cols) return
    if (lastCellRef.current.row === row && lastCellRef.current.col === col) return
    lastCellRef.current = { row, col }
    setCell(row, col, paintValueRef.current)
  }, [rowCount, cols, setCell])

  const onPointerDown = useCallback((e) => {
    e.preventDefault()
    e.target.setPointerCapture(e.pointerId)
    const { row, col } = cellFromEvent(e)
    if (row < 0 || row >= rowCount || col < 0 || col >= cols) return
    paintValueRef.current = grid[row]?.[col] ? 0 : 1
    isPaintingRef.current = true
    lastCellRef.current = { row: -1, col: -1 }
    paintAt(row, col)
  }, [cellFromEvent, grid, rowCount, cols, paintAt])

  const onPointerMove = useCallback((e) => {
    if (!isPaintingRef.current) return
    e.preventDefault()
    const { row, col } = cellFromEvent(e)
    paintAt(row, col)
  }, [cellFromEvent, paintAt])

  const stopPainting = useCallback(() => { isPaintingRef.current = false }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={stopPainting}
        onPointerLeave={stopPainting}
      />
    </div>
  )
}
