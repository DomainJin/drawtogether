import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LS_KEYS, PERF_ROUTES } from '../../performance/config.js'
import { createPerfEvent } from '../../performance/perfApi.js'
import { lsSet, saveAdminKey, signUrl } from '../../performance/links.js'
import { usePerformanceStore } from '../../store/performanceStore.js'
import { usePerfEvent } from '../../hooks/usePerfEvent.js'
import { useWebFonts } from '../../hooks/useWebFonts.js'
import { ConfigEditorContext, LinkCard, SetupPanel, ShowStage, useConfigEditor } from '../../components/Performance/index.js'
import { C, btnStyle, inputStyle } from '../../components/Performance/SetupPanel/styles.js'
import { useAdminKey } from './useAdminKey.js'

const SAVE_LABEL = {
  saved: { text: '✓ Đã lưu', color: C.ok },
  pending: { text: '… Đang sửa', color: C.muted },
  saving: { text: '… Đang lưu', color: C.muted },
  error: { text: '⚠ Chưa lưu được', color: C.danger },
}

function KeyGate({ onSubmit, error }) {
  const [v, setV] = useState('')
  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, color: C.text, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 360, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Nhập khoá quản trị</div>
        <div style={{ color: C.muted, fontSize: 13 }}>Khoá nằm trong "Link quản trị" của máy đã tạo sự kiện.</div>
        {error && <div style={{ color: C.danger, fontSize: 13 }}>{error}</div>}
        <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && v && onSubmit(v.trim())}
          style={{ ...inputStyle, height: 38 }} autoFocus />
        <button style={{ ...btnStyle('primary', !v), height: 38 }} disabled={!v} onClick={() => onSubmit(v.trim())}>Vào</button>
      </div>
    </div>
  )
}

/** Trang kỹ thuật: cài đặt bên trái, preview màn show + link QR bên phải. */
export default function PerfSetupPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const [adminKey, setAdminKey] = useAdminKey(eventId)
  const socketRef = usePerfEvent(eventId, 'admin', adminKey)
  const editor = useConfigEditor(socketRef)
  const event = usePerformanceStore((s) => s.event)
  const connected = usePerformanceStore((s) => s.connected)
  const error = usePerformanceStore((s) => s.error)
  const fontVersion = useWebFonts(editor.config?.name.font)
  const stageRef = useRef(null)
  const [notice, setNotice] = useState('')

  if (!adminKey || (error && !editor.config)) {
    return <KeyGate error={adminKey ? error : ''} onSubmit={setAdminKey} />
  }
  if (!editor.config || !editor.schema) {
    return <div style={{ position: 'fixed', inset: 0, background: C.bg, color: C.muted, display: 'grid', placeItems: 'center' }}>Đang kết nối…</div>
  }

  const openShow = () => window.open(PERF_ROUTES.show(eventId), `perf-show-${eventId}`, 'popup,width=1280,height=720')
  const copyAdminLink = async () => {
    const url = `${window.location.origin}${PERF_ROUTES.setup(eventId)}?key=${encodeURIComponent(adminKey)}`
    try {
      await navigator.clipboard.writeText(url)
      setNotice('Đã copy link quản trị — ai có link này sửa được sự kiện')
    } catch {
      window.prompt('Copy link quản trị:', url)
    }
    setTimeout(() => setNotice(''), 3000)
  }
  const newEvent = async () => {
    const name = window.prompt('Tên sự kiện mới:', 'Sự kiện')
    if (name === null) return
    try {
      const res = await createPerfEvent(name)
      saveAdminKey(res.event.id, res.adminKey)
      lsSet(LS_KEYS.lastEvent, res.event.id)
      navigate(PERF_ROUTES.setup(res.event.id))
    } catch (err) {
      setNotice(`Không tạo được sự kiện: ${err.message}`)
    }
  }

  const save = SAVE_LABEL[editor.saveState]
  const link = signUrl(eventId, editor.config.publicBaseUrl, window.location.origin)

  return (
    <ConfigEditorContext.Provider value={editor}>
      <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: C.bg, color: C.text, fontSize: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <button style={btnStyle()} onClick={() => navigate('/')} title="Về trang chủ">←</button>
          <div style={{ fontWeight: 800, fontSize: 15 }}>🎤 {event?.name}</div>
          <span style={{ color: C.muted, fontFamily: 'monospace' }}>{eventId}</span>
          <span title={connected ? 'Đã kết nối' : 'Mất kết nối'} style={{ width: 9, height: 9, borderRadius: '50%', background: connected ? C.ok : C.danger }} />
          <span style={{ color: save.color, fontSize: 12 }}>{save.text}</span>
          {editor.saveState === 'error' && <button style={btnStyle()} onClick={editor.retry}>Thử lại</button>}
          <div style={{ flex: 1 }} />
          {notice && <span style={{ color: C.accent, fontSize: 12 }}>{notice}</span>}
          <button style={btnStyle('primary')} onClick={openShow}>▶ Mở màn Show</button>
          <button style={btnStyle()} onClick={copyAdminLink}>🔑 Link quản trị</button>
          <button style={btnStyle()} onClick={newEvent}>+ Sự kiện mới</button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <div style={{ width: 400, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: C.panel, minHeight: 0 }}>
            <SetupPanel adminKey={adminKey} socketRef={socketRef} stageRef={stageRef} fontVersion={fontVersion} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>
            <div style={{ color: C.muted, fontSize: 12 }}>
              Xem trước màn show (khung {editor.config.output.frameW}×{editor.config.output.frameH}, vùng LED viền vàng)
            </div>
            <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}` }}>
              <ShowStage ref={stageRef} config={editor.config} signUrl={link} fontVersion={fontVersion} outlineRegion />
            </div>
            <LinkCard eventId={eventId} />
          </div>
        </div>
      </div>
    </ConfigEditorContext.Provider>
  )
}
