import { ColorInput, Field, Section, Select, Slider, TextInput, Toggle, pct } from './controls.jsx'
import { useConfigEditorContext } from './useConfigEditor.js'
import * as S from './styles.js'

export default function SignPageSection() {
  const { config, set, leaf } = useConfigEditorContext()
  const colors = config.sign.signerColors
  const maxColors = leaf('sign.signerColors')?.maxItems ?? 8

  const setColor = (i, c) => set('sign.signerColors', colors.map((x, j) => (j === i ? c : x)))
  const removeColor = (i) => colors.length > 1 && set('sign.signerColors', colors.filter((_, j) => j !== i))
  const addColor = () => colors.length < maxColors && set('sign.signerColors', [...colors, '#ffffff'])

  return (
    <>
      <Section title="Nội dung trang ký">
        <TextInput path="sign.title" label="Tiêu đề" />
        <TextInput path="sign.subtitle" label="Mô tả" />
        <Select path="sign.nameField" label="Ô nhập tên" labels={{ off: 'Ẩn', optional: 'Không bắt buộc', required: 'Bắt buộc' }} />
        {config.sign.nameField !== 'off' && <TextInput path="sign.namePlaceholder" label="Gợi ý ô tên" />}
        <TextInput path="sign.submitText" label="Nút gửi" />
        <TextInput path="sign.thanksText" label="Lời cảm ơn" />
        <Toggle path="sign.allowAgain" label="Cho ký nhiều lần" />
        <Toggle path="moderation.requireApproval" label="Duyệt trước khi hiện" />
      </Section>

      <Section title="Bảng ký">
        <ColorInput path="sign.padColor" label="Màu bảng" />
        <Slider path="sign.padOpacity" label="Độ đậm bảng" format={pct} />
        {config.ink.mode === 'signer' ? (
          <Field as="div" label="Màu cho người ký">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {colors.map((c, i) => (
                <span key={i} style={{ position: 'relative' }}>
                  <input type="color" value={c} onChange={(e) => setColor(i, e.target.value)}
                    style={{ width: 30, height: 30, border: 'none', padding: 0, background: 'none', cursor: 'pointer' }} />
                  {colors.length > 1 && (
                    <button onClick={() => removeColor(i)} title="Bỏ màu" style={{
                      position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: 8,
                      border: 'none', background: S.C.danger, color: '#fff', fontSize: 10, lineHeight: '16px', padding: 0, cursor: 'pointer',
                    }}>×</button>
                  )}
                </span>
              ))}
              {colors.length < maxColors && <button style={S.btnStyle()} onClick={addColor}>+</button>}
            </div>
          </Field>
        ) : (
          <div style={{ ...S.labelStyle, fontSize: 12 }}>Chọn "Người ký tự chọn" ở mục Nét chữ ký để khán giả chọn màu.</div>
        )}
      </Section>
    </>
  )
}
