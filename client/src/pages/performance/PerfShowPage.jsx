import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PERF_CONFIG as P } from '../../performance/config.js'
import { signUrl } from '../../performance/links.js'
import { enterFullscreen, exitFullscreen, fullscreenElement, FULLSCREEN_EVENTS } from '../../waterfall/fullscreen.js'
import { usePerformanceStore } from '../../store/performanceStore.js'
import { usePerfEvent } from '../../hooks/usePerfEvent.js'
import { useWebFonts } from '../../hooks/useWebFonts.js'
import ShowStage from '../../components/Performance/ShowStage/index.jsx'

/** Màn xuất ra LED. Trình duyệt chỉ cho vào toàn màn hình sau một cú bấm của
 *  người dùng → lớp phủ "Nhấn để trình chiếu"; F bật/tắt; con trỏ tự ẩn. */
export default function PerfShowPage() {
  const { eventId } = useParams()
  usePerfEvent(eventId, 'show')
  const config = usePerformanceStore((s) => s.config)
  const connected = usePerformanceStore((s) => s.connected)
  const joinError = usePerformanceStore((s) => s.error)
  const fontVersion = useWebFonts(config?.name.font)

  const rootRef = useRef(null)
  const [isFull, setIsFull] = useState(false)
  const [cursorHidden, setCursorHidden] = useState(false)

  useEffect(() => {
    const sync = () => setIsFull(!!fullscreenElement(document))
    FULLSCREEN_EVENTS.forEach((ev) => document.addEventListener(ev, sync))
    return () => FULLSCREEN_EVENTS.forEach((ev) => document.removeEventListener(ev, sync))
  }, [])

  const toggleFull = useCallback(async () => {
    if (fullscreenElement(document)) await exitFullscreen(document)
    else await enterFullscreen(rootRef.current)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'f' || e.key === 'F') toggleFull() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleFull])

  useEffect(() => {
    let timer = setTimeout(() => setCursorHidden(true), P.CURSOR_HIDE_MS)
    const onMove = () => {
      setCursorHidden(false)
      clearTimeout(timer)
      timer = setTimeout(() => setCursorHidden(true), P.CURSOR_HIDE_MS)
    }
    window.addEventListener('pointermove', onMove)
    return () => { clearTimeout(timer); window.removeEventListener('pointermove', onMove) }
  }, [])

  const link = config ? signUrl(eventId, config.publicBaseUrl, window.location.origin) : ''

  return (
    <div ref={rootRef} style={{ position: 'fixed', inset: 0, background: '#000', cursor: cursorHidden ? 'none' : 'default' }}>
      {config && <ShowStage config={config} signUrl={link} fontVersion={fontVersion} />}

      {!config && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontSize: 18 }}>
          {joinError || 'Đang kết nối…'}
        </div>
      )}

      {config && !isFull && !cursorHidden && (
        <button
          onClick={toggleFull}
          style={{
            position: 'absolute', left: '50%', bottom: 32, transform: 'translateX(-50%)',
            padding: '14px 26px', borderRadius: 28, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.92)', color: '#111', fontSize: 16, fontWeight: 700,
            boxShadow: '0 6px 24px rgba(0,0,0,0.5)',
          }}
        >⛶ Trình chiếu toàn màn hình (F)</button>
      )}

      {/* Chỉ hiện khi mất kết nối — kỹ thuật cần biết, khán giả thì không thấy gì khác. */}
      {config && !connected && (
        <div title="Mất kết nối server, đang thử lại" style={{
          position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%',
          background: '#ef476f', boxShadow: '0 0 8px #ef476f',
        }} />
      )}
    </div>
  )
}
