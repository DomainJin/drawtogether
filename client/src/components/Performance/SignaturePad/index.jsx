import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useSignaturePad } from './useSignaturePad.js'

const hexAlpha = (hex, a) => {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/** Bảng ký tỉ lệ cố định `aspect`. ref: { undo, clear, getStrokes }.
 *  `onChange(info)` báo số nét/điểm để trang bật/tắt nút. */
const SignaturePad = forwardRef(function SignaturePad({ ink, color, aspect, padColor, padOpacity, onChange }, ref) {
  const canvasRef = useRef(null)
  const pad = useSignaturePad(canvasRef, { ink, color, aspect })
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  useEffect(() => { onChangeRef.current?.(pad.info) }, [pad.info])

  useImperativeHandle(ref, () => ({ undo: pad.undo, clear: pad.clear, getStrokes: pad.getStrokes }), [pad.undo, pad.clear, pad.getStrokes])

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: String(aspect),
      borderRadius: 16, overflow: 'hidden',
      background: hexAlpha(padColor, padOpacity),
      border: '1.5px dashed rgba(255,255,255,0.35)',
      boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
    }}>
      {pad.info.strokes === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'rgba(255,255,255,0.45)', fontSize: 18, pointerEvents: 'none', userSelect: 'none',
        }}>✍️ Ký vào đây</div>
      )}
      <canvas
        ref={canvasRef}
        {...pad.handlers}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'crosshair' }}
      />
    </div>
  )
})

export default SignaturePad
