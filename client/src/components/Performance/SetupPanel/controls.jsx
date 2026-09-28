/** Control gắn với một đường dẫn config ('ink.width'…). min/max/step/options
 *  lấy từ schema server gửi — không gõ lại giới hạn ở client. */
import { useConfigEditorContext } from './useConfigEditor.js'
import * as S from './styles.js'

export function Section({ title, children, right }) {
  return (
    <div style={S.sectionStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={S.sectionTitleStyle}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  )
}

/** as="div" khi bên trong có nhiều control — <label> sẽ chuyển mọi cú bấm vào control đầu tiên. */
export function Field({ label, children, as: Tag = 'label' }) {
  return (
    <Tag style={S.fieldStyle}>
      <span style={S.labelStyle}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>{children}</div>
    </Tag>
  )
}

/** Slider cho lá num/int. `format(v)` hiển thị (vd phần trăm). */
export function Slider({ path, label, format = (v) => v, disabled }) {
  const { get, set, leaf, config } = useConfigEditorContext()
  const d = leaf(path)
  if (!d || !config) return null
  const v = get(path)
  return (
    <Field label={label}>
      <input type="range" min={d.min} max={d.max} step={d.t === 'int' ? 1 : d.step} value={v} disabled={disabled}
        onChange={(e) => set(path, Number(e.target.value))} style={{ flex: 1, minWidth: 0, accentColor: S.C.accent }} />
      <span style={S.valueStyle}>{format(v)}</span>
    </Field>
  )
}

export function NumberInput({ path, label, disabled, suffix }) {
  const { get, set, leaf } = useConfigEditorContext()
  const d = leaf(path)
  if (!d) return null
  return (
    <Field label={label}>
      <input type="number" min={d.min} max={d.max} step={d.t === 'int' ? 1 : d.step} value={get(path)} disabled={disabled}
        onChange={(e) => e.target.value !== '' && set(path, Number(e.target.value))}
        style={{ ...S.inputStyle, opacity: disabled ? 0.5 : 1 }} />
      {suffix && <span style={S.labelStyle}>{suffix}</span>}
    </Field>
  )
}

/** `labels`: { giá trị: nhãn tiếng Việt } — giá trị lạ (schema mới hơn) hiện nguyên. */
export function Select({ path, label, labels = {} }) {
  const { get, set, leaf } = useConfigEditorContext()
  const d = leaf(path)
  if (!d) return null
  return (
    <Field label={label}>
      <select value={get(path)} onChange={(e) => set(path, e.target.value)} style={S.inputStyle}>
        {d.options.map((o) => <option key={o} value={o}>{labels[o] ?? o}</option>)}
      </select>
    </Field>
  )
}

export function ColorInput({ path, label }) {
  const { get, set } = useConfigEditorContext()
  const v = get(path)
  return (
    <Field label={label}>
      <input type="color" value={v} onChange={(e) => set(path, e.target.value)}
        style={{ width: 44, height: 30, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
      <span style={S.valueStyle}>{v}</span>
    </Field>
  )
}

export function Toggle({ path, label }) {
  const { get, set } = useConfigEditorContext()
  const v = !!get(path)
  return (
    <Field label={label}>
      <input type="checkbox" checked={v} onChange={(e) => set(path, e.target.checked)}
        style={{ width: 18, height: 18, accentColor: S.C.accent, cursor: 'pointer' }} />
    </Field>
  )
}

export function TextInput({ path, label, placeholder }) {
  const { get, set, leaf } = useConfigEditorContext()
  const d = leaf(path)
  return (
    <Field label={label}>
      <input type="text" value={get(path)} maxLength={d?.maxLen} placeholder={placeholder}
        onChange={(e) => set(path, e.target.value)} style={S.inputStyle} />
    </Field>
  )
}

export const pct = (v) => `${Math.round(v * 100)}%`
export const ms = (v) => `${(v / 1000).toFixed(1)}s`
