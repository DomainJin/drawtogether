import { useMemo, useRef, useState } from 'react'
import { CLIP_CONFIG as C } from '../../../performance/config.js'
import { estimateClipMs, evenFloor, replayEffect, suggestSpanSeconds } from '../../../performance/replaySchedule.js'
import { signUrl as buildSignUrl } from '../../../performance/links.js'
import { usePerformanceStore } from '../../../store/performanceStore.js'
import { Field, Section } from './controls.jsx'
import { QUALITIES, useClipRender } from './useClipRender.js'
import * as S from './styles.js'

const mmss = (ms) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
const PREVIEW_W = 340

/** Dựng lại clip màn show từ các chữ ký đang hiện — SPEC §8. Tuỳ chọn ở đây là
 *  của riêng lần dựng (không lưu vào config sự kiện). */
export default function ClipSection() {
  const signatures = usePerformanceStore((s) => s.signatures)
  const config = usePerformanceStore((s) => s.config)
  const eventId = usePerformanceStore((s) => s.eventId)
  const sigs = useMemo(() => signatures.filter((s) => s.status === 'visible'), [signatures])

  const [mode, setMode] = useState('even')
  const [spanSeconds, setSpanSeconds] = useState(() => suggestSpanSeconds(sigs.length))
  const [fps, setFps] = useState(C.DEFAULT_FPS)
  const [quality, setQuality] = useState('high')
  const [includeQr, setIncludeQr] = useState(config.qr.show)
  const previewRef = useRef(null)
  const clip = useClipRender(previewRef)

  const W = evenFloor(config.output.w)
  const H = evenFloor(config.output.h)
  const span = Math.min(C.MAX_SPAN_S, Math.max(C.MIN_SPAN_S, Number(spanSeconds) || C.MIN_SPAN_S))
  const interval = sigs.length > 1 ? (span * 1000) / (sigs.length - 1) : span * 1000
  const effect = replayEffect(config.effect, interval)
  const running = clip.status === 'running'

  const onStart = () => clip.start({
    sigs,
    signUrl: buildSignUrl(eventId, config.publicBaseUrl, window.location.origin),
    mode,
    spanSeconds: span,
    fps,
    quality,
    includeQr,
  })

  return (
    <Section title="🎬 Dựng lại clip">
      <div style={{ ...S.labelStyle, fontSize: 12, lineHeight: 1.45 }}>
        Phát lại {sigs.length} chữ ký đang hiện theo đúng thứ tự đã ký, với style/hiệu ứng hiện tại, rồi xuất video
        {' '}{W}×{H}. Dựng từ dữ liệu nên clip luôn mượt; máy yếu chỉ dựng lâu hơn. Giữ tab này mở tới khi xong.
      </div>

      <Field label="Nhịp xuất hiện">
        <select value={mode} disabled={running} onChange={(e) => setMode(e.target.value)} style={S.inputStyle}>
          <option value="even">Đều nhau</option>
          <option value="real">Theo thời gian thật (rút gọn lúc vắng)</option>
        </select>
      </Field>
      <Field label="Phần ký dài">
        <input type="number" min={C.MIN_SPAN_S} max={C.MAX_SPAN_S} value={spanSeconds} disabled={running}
          onChange={(e) => setSpanSeconds(e.target.value)} style={S.inputStyle} />
        <span style={S.labelStyle}>giây</span>
      </Field>
      <Field label="Khung hình">
        <select value={fps} disabled={running} onChange={(e) => setFps(Number(e.target.value))} style={S.inputStyle}>
          {C.FPS_OPTIONS.map((f) => <option key={f} value={f}>{f} fps</option>)}
        </select>
      </Field>
      <Field label="Chất lượng">
        <select value={quality} disabled={running} onChange={(e) => setQuality(e.target.value)} style={S.inputStyle}>
          {Object.entries(QUALITIES).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </Field>
      {config.qr.show && (
        <Field label="Hiện QR">
          <input type="checkbox" checked={includeQr} disabled={running} onChange={(e) => setIncludeQr(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: S.C.accent }} />
        </Field>
      )}

      <div style={{ ...S.labelStyle, fontSize: 12 }}>
        Clip dài khoảng <b style={{ color: S.C.text }}>{mmss(estimateClipMs(span * 1000, effect))}</b>
        {config.effect.spotlight && !effect.spotlight && ' · spotlight tắt vì chữ ký xuất hiện quá dày (tăng "Phần ký dài" để bật)'}
      </div>

      {running ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#0c0f15', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(clip.progress * 100)}%`, height: '100%', background: S.C.accent }} />
          </div>
          <span style={S.valueStyle}>{Math.round(clip.progress * 100)}%</span>
          <button style={S.btnStyle('danger')} onClick={clip.cancel}>Huỷ</button>
        </div>
      ) : (
        <button style={S.btnStyle('primary', !sigs.length)} disabled={!sigs.length} onClick={onStart}>
          🎬 Dựng clip
        </button>
      )}

      <canvas ref={previewRef} width={PREVIEW_W} height={Math.round((PREVIEW_W * H) / W)}
        style={{ width: '100%', borderRadius: 6, background: '#000', display: running || clip.status === 'done' ? 'block' : 'none' }} />

      {clip.warning && <div style={{ color: S.C.accent, fontSize: 12 }}>{clip.warning}</div>}
      {clip.error && <div style={{ color: S.C.danger, fontSize: 12 }}>{clip.error}</div>}
      {clip.status === 'done' && clip.result && (
        <div style={{ color: S.C.ok, fontSize: 12 }}>
          ✓ Đã tải clip {clip.result.ext} ({clip.result.codec}, {mmss(clip.result.durationMs)},
          {' '}{(clip.result.blob.size / 1048576).toFixed(1)}MB)
        </div>
      )}
    </Section>
  )
}
