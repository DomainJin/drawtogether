import { useCallback, useEffect, useRef, useState } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { totalPoints } from '../../../performance/strokeCodec.js'
import { drawInk } from '../../../performance/render/drawSignature.js'

const clamp01 = (v) => Math.min(1, Math.max(0, v))

/** Ghi nét ký bằng Pointer Events (chuột, bút, ngón tay như nhau) và vẽ lại
 *  bằng đúng drawInk của màn show — người ký thấy y như sẽ hiện trên LED.
 *
 *  Nét lưu ở ref (không phải state): pointermove 120Hz mà setState mỗi lần là
 *  re-render cả trang. React chỉ biết số nét (để bật/tắt nút). */
export function useSignaturePad(canvasRef, { ink, color, aspect }) {
  const strokesRef = useRef([])
  const activeRef = useRef(null)     // { pointerId, stroke }
  const startRef = useRef(null)      // mốc t = 0 (performance.now)
  const rafRef = useRef(0)
  const styleRef = useRef({ ink, color, aspect })
  styleRef.current = { ink, color, aspect }
  const [info, setInfo] = useState({ strokes: 0, points: 0, full: false })

  const redraw = useCallback(() => {
    rafRef.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const { ink: k, color: c, aspect: a } = styleRef.current
    // Hệ pad units: cao canvas = 1.
    ctx.setTransform(canvas.height, 0, 0, canvas.height, 0, 0)
    drawInk(ctx, { strokes: strokesRef.current, aspect: a, color: c }, k)
  }, [canvasRef])

  const scheduleRedraw = useCallback(() => {
    if (!rafRef.current) rafRef.current = requestAnimationFrame(redraw)
  }, [redraw])

  const syncInfo = useCallback(() => {
    const points = totalPoints(strokesRef.current)
    setInfo({
      strokes: strokesRef.current.length,
      points,
      full: points >= P.MAX_POINTS || strokesRef.current.length >= P.MAX_STROKES,
    })
  }, [])

  // Canvas theo kích thước hiển thị × DPR, vẽ lại khi xoay máy/đổi cỡ.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      scheduleRedraw()
    })
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [canvasRef, scheduleRedraw])

  useEffect(() => { scheduleRedraw() }, [ink, color, aspect, scheduleRedraw])
  // Phải trả rafRef về 0: StrictMode chạy cleanup rồi mount lại — rafRef còn
  // giữ id đã huỷ thì scheduleRedraw tưởng đang chờ vẽ và không bao giờ vẽ nữa.
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
  }, [])

  const toPad = (e) => {
    const r = canvasRef.current.getBoundingClientRect()
    return [clamp01((e.clientX - r.left) / r.width), clamp01((e.clientY - r.top) / r.height)]
  }

  const addPoint = (stroke, x, y, force = false) => {
    const n = stroke.length
    if (!force && n >= 3) {
      const a = styleRef.current.aspect
      const d = Math.hypot((x - stroke[n - 3]) * a, y - stroke[n - 2])
      if (d < P.MIN_POINT_DIST) return
    }
    if (totalPoints(strokesRef.current) >= P.MAX_POINTS) return
    stroke.push(x, y, Math.round(performance.now() - startRef.current))
  }

  const onPointerDown = useCallback((e) => {
    if (activeRef.current || info.full) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    startRef.current ??= performance.now()
    const stroke = []
    const [x, y] = toPad(e)
    addPoint(stroke, x, y, true)
    strokesRef.current = [...strokesRef.current, stroke]
    activeRef.current = { pointerId: e.pointerId, stroke }
    scheduleRedraw()
  }, [info.full, scheduleRedraw]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    const active = activeRef.current
    if (!active || active.pointerId !== e.pointerId) return
    e.preventDefault()
    // Điểm gộp: trình duyệt gom nhiều mẫu vào một event — lấy hết cho nét mượt.
    const events = e.nativeEvent.getCoalescedEvents?.() ?? []
    for (const ev of events.length ? events : [e]) {
      const [x, y] = toPad(ev)
      addPoint(active.stroke, x, y)
    }
    scheduleRedraw()
  }, [scheduleRedraw]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerUp = useCallback((e) => {
    const active = activeRef.current
    if (!active || active.pointerId !== e.pointerId) return
    const [x, y] = toPad(e)
    addPoint(active.stroke, x, y)
    activeRef.current = null
    scheduleRedraw()
    syncInfo()
  }, [scheduleRedraw, syncInfo]) // eslint-disable-line react-hooks/exhaustive-deps

  const undo = useCallback(() => {
    strokesRef.current = strokesRef.current.slice(0, -1)
    if (!strokesRef.current.length) startRef.current = null
    scheduleRedraw()
    syncInfo()
  }, [scheduleRedraw, syncInfo])

  const clear = useCallback(() => {
    strokesRef.current = []
    startRef.current = null
    scheduleRedraw()
    syncInfo()
  }, [scheduleRedraw, syncInfo])

  const getStrokes = useCallback(() => strokesRef.current.filter((s) => s.length >= 3), [])

  return {
    info,
    undo,
    clear,
    getStrokes,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  }
}
