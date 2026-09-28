import { useMemo, useState } from 'react'
import { PERF_CONFIG as P } from '../../../performance/config.js'
import { styleOf } from '../../../performance/render/exportImages.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'
import { Section } from './controls.jsx'
import SignatureThumb from './SignatureThumb.jsx'
import { useSignatureActions } from './useSignatureActions.js'
import * as S from './styles.js'

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'visible', label: 'Đang hiện' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'hidden', label: 'Đã ẩn' },
]
const BADGE = {
  visible: { text: 'Đang hiện', color: S.C.ok },
  pending: { text: 'Chờ duyệt', color: S.C.accent },
  hidden: { text: 'Đã ẩn', color: S.C.muted },
}

const timeOf = (ms) => new Date(ms).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export default function SignatureManager({ socketRef, stageRef, fontVersion }) {
  const signatures = usePerformanceStore((s) => s.signatures)
  const config = usePerformanceStore((s) => s.config)
  const style = useMemo(() => styleOf(config), [config])
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(P.MANAGER_PAGE_SIZE)
  const act = useSignatureActions(socketRef, stageRef)

  const counts = useMemo(() => {
    const c = { all: signatures.length, visible: 0, pending: 0, hidden: 0 }
    for (const s of signatures) c[s.status] = (c[s.status] ?? 0) + 1
    return c
  }, [signatures])

  // Số thứ tự theo thời gian ký (khớp tên file xuất ra); danh sách mới nhất lên đầu.
  const indexOf = useMemo(() => new Map(signatures.map((s, i) => [s.id, i])), [signatures])
  const list = useMemo(() => {
    const l = filter === 'all' ? signatures : signatures.filter((s) => s.status === filter)
    return [...l].reverse()
  }, [signatures, filter])

  const confirmClear = () => {
    if (window.confirm(`Xoá VĨNH VIỄN cả ${signatures.length} chữ ký? Nên tải ZIP trước.`)) act.clearAll()
  }

  return (
    <>
      <Section title="Lưu ảnh">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button style={S.btnStyle('primary', !!act.busy)} disabled={!!act.busy} onClick={act.downloadSnapshot}>📸 Chụp màn show (PNG)</button>
          <button style={S.btnStyle('default', !!act.busy || !list.length)} disabled={!!act.busy || !list.length}
            onClick={() => act.downloadZip([...list].reverse())}>
            🗂 Tải {list.length} chữ ký (ZIP)
          </button>
        </div>
        {act.busy && <div style={{ ...S.labelStyle, fontSize: 12 }}>Đang xử lý: {act.busy}</div>}
      </Section>

      <Section
        title={`Chữ ký (${signatures.length})`}
        right={<button style={S.btnStyle('danger', !signatures.length)} disabled={!signatures.length} onClick={confirmClear}>Xoá tất cả</button>}
      >
        <div style={{ display: 'flex', gap: 4, background: '#0c0f15', borderRadius: 10, padding: 3 }}>
          {FILTERS.map((f) => (
            <button key={f.key} style={S.tabStyle(filter === f.key)} onClick={() => { setFilter(f.key); setLimit(P.MANAGER_PAGE_SIZE) }}>
              {f.label} {counts[f.key] ? `(${counts[f.key]})` : ''}
            </button>
          ))}
        </div>
        {act.error && <div style={{ color: S.C.danger, fontSize: 12 }}>{act.error}</div>}
        {!list.length && <div style={{ ...S.labelStyle, fontSize: 13, textAlign: 'center', padding: 20 }}>Chưa có chữ ký nào</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.slice(0, limit).map((sig) => {
            const b = BADGE[sig.status] ?? BADGE.hidden
            const idx = indexOf.get(sig.id)
            return (
              <div key={sig.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#0c0f15', borderRadius: 10, padding: 6 }}>
                <div style={{ background: config.showBg.color, borderRadius: 6, flexShrink: 0 }}>
                  <SignatureThumb sig={sig} style={style} fontVersion={fontVersion} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    #{idx + 1} {sig.name || <span style={S.labelStyle}>(không tên)</span>}
                  </div>
                  <div style={{ fontSize: 11.5, display: 'flex', gap: 8 }}>
                    <span style={{ color: b.color, fontWeight: 700 }}>{b.text}</span>
                    <span style={S.labelStyle}>{timeOf(sig.createdAt)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {sig.status !== 'visible' && (
                      <button style={S.btnStyle('ok')} onClick={() => act.setStatus(sig.id, 'visible')}>{sig.status === 'pending' ? 'Duyệt' : 'Hiện'}</button>
                    )}
                    {sig.status === 'visible' && <button style={S.btnStyle()} onClick={() => act.setStatus(sig.id, 'hidden')}>Ẩn</button>}
                    <button style={S.btnStyle()} onClick={() => act.downloadOne(sig, idx)}>PNG</button>
                    <button style={S.btnStyle('danger')} onClick={() => window.confirm('Xoá chữ ký này?') && act.remove(sig.id)}>Xoá</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {list.length > limit && (
          <button style={S.btnStyle()} onClick={() => setLimit((l) => l + P.MANAGER_PAGE_SIZE)}>
            Xem thêm ({list.length - limit})
          </button>
        )}
      </Section>
    </>
  )
}
