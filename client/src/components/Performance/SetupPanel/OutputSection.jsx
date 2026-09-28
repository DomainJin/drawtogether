import { PERF_CONFIG as P } from '../../../performance/config.js'
import { Field, NumberInput, Section, Toggle } from './controls.jsx'
import { useConfigEditorContext } from './useConfigEditor.js'
import * as S from './styles.js'

/** Khung xuất 16:9 (độ phân giải card đồ hoạ đưa vào bộ xử lý LED) và vùng
 *  LED thật trong khung đó. */
export default function OutputSection() {
  const { config, set, setMany } = useConfigEditorContext()
  const o = config.output
  const preset = P.FRAME_PRESETS.find((p) => p.w === o.frameW && p.h === o.frameH)

  const applyPreset = (label) => {
    const p = P.FRAME_PRESETS.find((x) => x.label === label)
    if (!p) return
    setMany([['output.frameW', p.w], ['output.frameH', p.h], ['output.x', 0], ['output.y', 0], ['output.w', p.w], ['output.h', p.h]])
  }

  // lock169 → frameH đi theo frameW ngay ở preview (server cũng ép lại).
  const setFrameW = (w) => {
    if (o.lock169) setMany([['output.frameW', w], ['output.frameH', Math.round((w * 9) / 16)]])
    else set('output.frameW', w)
  }

  return (
    <Section title="Khung xuất & vùng LED">
      <Field label="Preset khung">
        <select value={preset?.label ?? ''} onChange={(e) => applyPreset(e.target.value)} style={S.inputStyle}>
          {!preset && <option value="">Tuỳ chỉnh {o.frameW}×{o.frameH}</option>}
          {P.FRAME_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
        </select>
      </Field>
      <Toggle path="output.lock169" label="Khoá 16:9" />
      <Field label="Rộng khung">
        <input type="number" value={o.frameW} min={320} onChange={(e) => e.target.value && setFrameW(Number(e.target.value))} style={S.inputStyle} />
        <span style={S.labelStyle}>px</span>
      </Field>
      <NumberInput path="output.frameH" label="Cao khung" suffix="px" disabled={o.lock169} />

      <div style={{ ...S.labelStyle, fontSize: 12, lineHeight: 1.4 }}>
        Vùng LED: phần khung thực sự hiện lên màn LED (toạ độ px trong khung). Ngoài vùng là đen.
      </div>
      <NumberInput path="output.x" label="X" suffix="px" />
      <NumberInput path="output.y" label="Y" suffix="px" />
      <NumberInput path="output.w" label="Rộng vùng" suffix="px" />
      <NumberInput path="output.h" label="Cao vùng" suffix="px" />
      <button style={S.btnStyle()} onClick={() => setMany([['output.x', 0], ['output.y', 0], ['output.w', o.frameW], ['output.h', o.frameH]])}>
        Vùng = toàn khung
      </button>
    </Section>
  )
}
