import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PERF_CONFIG as P } from '../../performance/config.js'
import { usePerformanceStore } from '../../store/performanceStore.js'
import { usePerfEvent } from '../../hooks/usePerfEvent.js'
import { useWebFonts } from '../../hooks/useWebFonts.js'
import MediaBackground from '../../components/Performance/MediaBackground.jsx'
import SignaturePad from '../../components/Performance/SignaturePad/index.jsx'
import { usePerfSign } from './usePerfSign.js'
import * as S from './signStyles.js'

/** Trang khán giả mở từ QR: ký → gửi → chữ ký lên màn LED. */
export default function PerfSignPage() {
  const { eventId } = useParams()
  const socketRef = usePerfEvent(eventId, 'signer')
  const config = usePerformanceStore((s) => s.config)
  const joinError = usePerformanceStore((s) => s.error)
  const connected = usePerformanceStore((s) => s.connected)
  useWebFonts(config?.name.font)

  const padRef = useRef(null)
  const [padInfo, setPadInfo] = useState({ strokes: 0, full: false })
  const [name, setName] = useState('')
  const [color, setColor] = useState(null)
  const { phase, error, submit, again } = usePerfSign(eventId, socketRef)

  if (!config) {
    return (
      <div style={S.pageStyle}>
        <div style={S.centerStyle}>
          <div style={{ fontSize: 17, opacity: 0.85 }}>{joinError || 'Đang kết nối…'}</div>
        </div>
      </div>
    )
  }

  const sign = config.sign
  const signerMode = config.ink.mode === 'signer'
  const inkColor = signerMode ? (color ?? sign.signerColors[0]) : null
  const nameMissing = sign.nameField === 'required' && !name.trim()
  const canSend = padInfo.strokes > 0 && !nameMissing && phase !== 'sending'

  const onSend = async () => {
    const ok = await submit({
      strokes: padRef.current.getStrokes(),
      name: sign.nameField === 'off' ? '' : name.trim(),
      color: inkColor,
    })
    if (ok) {
      padRef.current?.clear()
      setName('')
    }
  }

  return (
    <div style={S.pageStyle}>
      <MediaBackground bg={config.signBg} />
      {phase === 'done' ? (
        <div style={S.centerStyle}>
          <div style={{ fontSize: 56 }}>🎉</div>
          <div style={S.titleStyle}>{sign.thanksText}</div>
          {sign.allowAgain && (
            <button style={S.ghostBtn(false)} onClick={again}>Ký thêm chữ ký khác</button>
          )}
        </div>
      ) : (
        <div style={S.scrollStyle}>
          <div style={S.columnStyle}>
            <div style={S.titleStyle}>{sign.title}</div>
            {sign.subtitle && <div style={S.subtitleStyle}>{sign.subtitle}</div>}

            <SignaturePad
              ref={padRef}
              ink={config.ink}
              color={inkColor}
              aspect={P.SIGN_PAD_ASPECT}
              padColor={sign.padColor}
              padOpacity={sign.padOpacity}
              onChange={setPadInfo}
            />

            <div style={{ ...S.rowStyle, justifyContent: 'space-between' }}>
              <div style={S.rowStyle}>
                <button style={S.ghostBtn(!padInfo.strokes)} disabled={!padInfo.strokes} onClick={() => padRef.current.undo()}>↶ Hoàn tác</button>
                <button style={S.ghostBtn(!padInfo.strokes)} disabled={!padInfo.strokes} onClick={() => padRef.current.clear()}>Xoá</button>
              </div>
              {signerMode && (
                <div style={S.rowStyle}>
                  {sign.signerColors.map((c) => (
                    <button key={c} aria-label={`Màu ${c}`} style={S.swatchStyle(c, c === inkColor)} onClick={() => setColor(c)} />
                  ))}
                </div>
              )}
            </div>
            {padInfo.full && <div style={S.subtitleStyle}>Đã đủ độ dài tối đa của chữ ký</div>}

            {sign.nameField !== 'off' && (
              <input
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                placeholder={sign.namePlaceholder + (sign.nameField === 'optional' ? ' (không bắt buộc)' : '')}
                style={S.inputStyle}
                enterKeyHint="send"
                onKeyDown={(e) => { if (e.key === 'Enter' && canSend) onSend() }}
              />
            )}

            {error && <div style={S.errorStyle}>{error}</div>}
            {!connected && <div style={S.subtitleStyle}>Đang kết nối lại…</div>}

            <button style={S.primaryBtn(!canSend)} disabled={!canSend} onClick={onSend}>
              {phase === 'sending' ? 'Đang gửi…' : sign.submitText}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
